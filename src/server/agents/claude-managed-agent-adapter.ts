import "server-only";

import { shouldUseMockData } from "@/lib/env";
import {
  getManagedAgentsClientFromEnv,
  type ManagedAgentEvent,
  type ManagedSessionResource,
} from "@/lib/anthropic/managed-agents-api";
import { AGENT_RUN_PROGRESS_EVENT, agentRunProgressPayload } from "@/server/agents/agent-run-activity";
import type { AgentAdapter } from "@/server/agents/types";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import {
  importAnthropicSessionFiles,
  prepareAnthropicSessionFileResources,
  saveAgentGeneratedTextFile,
  type MountedAgentFile,
} from "@/server/files/file-service";
import { executeTool } from "@/server/agents/tools/execute-tool";
import type { AgentRunInput } from "@/server/agents/types";
import type { Agent, FileRecord } from "@/types/domain";

const STREAM_TIMEOUT_MS = 55_000;

export class RealClaudeManagedAgentAdapter implements AgentAdapter {
  async run(input: AgentRunInput) {
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const agent = await source.getAgent(input.agentId);
    if (!agent?.anthropicAgentId || !agent.anthropicEnvironmentId) {
      await emitProgress(input, {
        key: "setup_required",
        title: "Claude 연결 확인 필요",
        detail: "Managed Agents 리소스가 아직 연결되지 않았습니다.",
      });
      return {
        content: "Claude Managed Agents 리소스가 아직 연결되지 않았습니다. `pnpm agents:provision`으로 봇 ID를 먼저 생성해 주세요.",
        anthropicSessionId: null,
        tokenUsage: { mode: "setup-required" },
        events: [
          {
            type: "real_adapter.setup_required",
            payload: {
              agentId: input.agentId,
              roomId: input.roomId,
              docs: "docs/ANTHROPIC_SETUP.md",
              betaHeader: process.env.ANTHROPIC_BETA_HEADER ?? "managed-agents-2026-04-01",
            },
          },
        ],
      };
    }
    const connectedAgent: Agent & { anthropicAgentId: string; anthropicEnvironmentId: string } = {
      ...agent,
      anthropicAgentId: agent.anthropicAgentId,
      anthropicEnvironmentId: agent.anthropicEnvironmentId,
    };

    const client = getManagedAgentsClientFromEnv();
    const controller = new AbortController();
    const abortFromInput = () => controller.abort();
    if (input.signal?.aborted) {
      controller.abort();
    } else {
      input.signal?.addEventListener("abort", abortFromInput, { once: true });
    }
    const timeout = windowlessTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    const events: ManagedAgentEvent[] = [];

    try {
      assertNotAborted(controller.signal);
      await emitProgress(input, {
        key: "file_prepare",
        title: "방 파일 준비",
        detail: "참고할 수 있는 방 파일을 확인합니다.",
      });
      const preparedFiles = await safePrepareMountedFiles(input, events);
      assertNotAborted(controller.signal);
      await emitProgress(input, {
        key: "session",
        title: "Claude 세션 준비",
        detail: connectedAgent.name,
      });
      const sessionResult = await createSessionWithFileFallback({
        client,
        agent: connectedAgent,
        input,
        mountedFiles: preparedFiles,
        events,
      });
      const { session, mountedFiles } = sessionResult;

      const filesMountedEvent = {
        type: "schoolx.files_mounted",
        files: mountedFiles.map((file) => ({
          roomId: file.roomId,
          fileId: file.fileId,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          mountPath: file.mountPath,
          anthropicFileId: file.anthropicFileId,
        })),
      };
      events.push(filesMountedEvent);
      await emitManagedEvent(input, filesMountedEvent);
      await emitProgress(input, {
        key: "files_mounted",
        title: "참고 파일 연결",
        detail: mountedFiles.length ? `${mountedFiles.length}개 파일을 세션에 연결했습니다.` : "연결할 파일이 없습니다.",
      });

      let streamResponse: Response | null = null;
      streamResponse = await client.openEventStream(session.id, controller.signal);
      assertNotAborted(controller.signal);
      await client.sendUserMessage(
        session.id,
        formatManagedAgentPrompt(
          input,
          connectedAgent.name,
          mountedFiles,
          sessionResult.fileMountError,
          sessionResult.memoryMountError,
        ),
      );
      await emitProgress(input, {
        key: "prompt_sent",
        title: "요청 전달",
        detail: "봇이 작업을 시작했습니다.",
      });
      const streamed = await readEventStream(streamResponse, controller.signal, async (blockingEvents) => {
        const toolResultEvents: ManagedAgentEvent[] = [];
        for (const event of blockingEvents) {
          if (event.type !== "agent.custom_tool_use") {
            throw new Error(`Unsupported requires_action event: ${event.type ?? "unknown"}`);
          }
          if (!event.id || !event.name) {
            throw new Error("Malformed custom tool use event.");
          }

          assertNotAborted(controller.signal);
          const result = await executeTool(input.agentRunId, event.name, event.input ?? {});
          assertNotAborted(controller.signal);
          await client.sendCustomToolResult(session.id, event.id, JSON.stringify(result));
          toolResultEvents.push({
            type: "schoolx.custom_tool_result",
            custom_tool_use_id: event.id,
            name: event.name,
            result,
          });
          await emitProgress(input, {
            key: `tool-result-${event.id}`,
            title: "도구 결과 반영",
            detail: friendlyToolName(event.name),
          });
        }
        return toolResultEvents;
      }, async (event) => {
        await emitManagedEvent(input, event);
        await emitProgressForManagedEvent(input, event);
      });
      events.push(...streamed);

      const content = extractAgentText(events).trim();
      const finalIdleEvent = [...events].reverse().find((event) => event.type === "session.status_idle");
      const requiresAction = finalIdleEvent?.stop_reason?.type === "requires_action";
      const generatedFiles = requiresAction ? [] : await safeImportGeneratedFiles(input, session.id, events, mountedFiles);
      if (generatedFiles.length) {
        await emitProgress(input, {
          key: "generated_files",
          title: "생성 파일 저장",
          detail: `${generatedFiles.length}개 파일을 방 파일함에 저장했습니다.`,
        });
      }

      return {
        content: content || "응답이 비어 있습니다. Claude Console의 session event stream을 확인해 주세요.",
        anthropicSessionId: session.id,
        tokenUsage: extractUsage(events),
        events: events.map((event) => ({
          type: event.type ?? "managed_agent.event",
          payload: sanitizeEvent(event),
        })),
        generatedFiles,
        requiresAction,
      };
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abortFromInput);
    }
  }
}

async function safePrepareMountedFiles(input: AgentRunInput, events: ManagedAgentEvent[]) {
  try {
    return await prepareAnthropicSessionFileResources({
      userId: input.userId,
      roomIds: fileResourceRoomIds(input),
    });
  } catch (error) {
    events.push({
      type: "schoolx.file_mount_prepare_failed",
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}

async function createSessionWithFileFallback(input: {
  client: ReturnType<typeof getManagedAgentsClientFromEnv>;
  agent: Agent & { anthropicAgentId: string; anthropicEnvironmentId: string };
  input: AgentRunInput;
  mountedFiles: MountedAgentFile[];
  events: ManagedAgentEvent[];
}) {
  const { fileResources, memoryResources } = buildManagedSessionResources(
    input.mountedFiles,
    input.input.memoryAttachments,
  );

  try {
    const session = await input.client.createSession({
      agentId: input.agent.anthropicAgentId!,
      environmentId: input.agent.anthropicEnvironmentId!,
      title: `${input.agent.name} · ${input.input.mode}`,
      resources: [...fileResources, ...memoryResources],
      metadata: {
        schoolx_agent_id: input.agent.id,
        schoolx_room_id: input.input.roomId,
        schoolx_thread_id: input.input.threadId,
        schoolx_mode: input.input.mode,
        schoolx_mounted_file_count: String(input.mountedFiles.length),
        schoolx_memory_store_count: String(memoryResources.length),
      },
    });
    return { session, mountedFiles: input.mountedFiles, fileMountError: null, memoryMountError: null };
  } catch (error) {
    if (memoryResources.length) {
      const memoryMountError = error instanceof Error ? error.message : String(error);
      input.events.push({
        type: "schoolx.memory_store_session_failed",
        error: memoryMountError,
        memoryStoreCount: memoryResources.length,
      });

      try {
        const session = await input.client.createSession({
          agentId: input.agent.anthropicAgentId!,
          environmentId: input.agent.anthropicEnvironmentId!,
          title: `${input.agent.name} · ${input.input.mode}`,
          resources: fileResources,
          metadata: {
            schoolx_agent_id: input.agent.id,
            schoolx_room_id: input.input.roomId,
            schoolx_thread_id: input.input.threadId,
            schoolx_mode: input.input.mode,
            schoolx_mounted_file_count: String(input.mountedFiles.length),
            schoolx_memory_store_count: "0",
            schoolx_memory_store_fallback: "true",
          },
        });
        return { session, mountedFiles: input.mountedFiles, fileMountError: null, memoryMountError };
      } catch (fileError) {
        error = fileError;
      }
    }

    if (!input.mountedFiles.length) {
      throw error;
    }

    const fileMountError = error instanceof Error ? error.message : String(error);
    input.events.push({
      type: "schoolx.file_mount_session_failed",
      error: fileMountError,
      mountedFileCount: input.mountedFiles.length,
    });

    const session = await input.client.createSession({
      agentId: input.agent.anthropicAgentId!,
      environmentId: input.agent.anthropicEnvironmentId!,
      title: `${input.agent.name} · ${input.input.mode}`,
      metadata: {
        schoolx_agent_id: input.agent.id,
        schoolx_room_id: input.input.roomId,
        schoolx_thread_id: input.input.threadId,
        schoolx_mode: input.input.mode,
        schoolx_mounted_file_count: "0",
        schoolx_file_mount_fallback: "true",
        schoolx_memory_store_count: "0",
      },
    });
    return { session, mountedFiles: [], fileMountError, memoryMountError: memoryResources.length ? "memory store fallback also removed file resources" : null };
  }
}

export function buildManagedSessionResources(
  mountedFiles: MountedAgentFile[],
  memoryAttachments: AgentRunInput["memoryAttachments"] = [],
) {
  const fileResources = mountedFiles.map(
    (file): ManagedSessionResource => ({
      type: "file",
      file_id: file.anthropicFileId,
      mount_path: file.mountPath,
    }),
  );
  const memoryResources = memoryAttachments
    .filter((attachment) => attachment.memoryStoreId)
    .map(
      (attachment): ManagedSessionResource => ({
        type: "memory_store",
        memory_store_id: attachment.memoryStoreId!,
        access: "read_only",
        prompt: `${attachment.purpose} Room ID: ${attachment.roomId}. Treat this as read-only School-X long-term memory.`,
      }),
    );
  return { fileResources, memoryResources };
}

async function safeImportGeneratedFiles(
  input: AgentRunInput,
  anthropicSessionId: string,
  events: ManagedAgentEvent[],
  mountedFiles: MountedAgentFile[],
) {
  try {
    const importedFiles = await importAnthropicSessionFiles({
      userId: input.userId,
      roomId: input.roomId,
      agentId: input.agentId,
      agentRunId: input.agentRunId,
      anthropicSessionId,
      excludedSourceFiles: mountedFiles.map((file) => ({
        anthropicFileId: file.anthropicFileId,
        originalName: file.originalName,
        sizeBytes: file.sizeBytes,
        mimeType: file.mimeType,
        mountPath: file.mountPath,
      })),
    });
    const existingNames = new Set(importedFiles.map((file) => file.originalName));
    const writtenFiles = await importWriteToolFiles(input, events, existingNames);
    return [...importedFiles, ...writtenFiles];
  } catch (error) {
    events.push({
      type: "schoolx.file_import_failed",
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}

async function importWriteToolFiles(input: AgentRunInput, events: ManagedAgentEvent[], existingNames: Set<string>) {
  const importedFiles: FileRecord[] = [];
  for (const event of events) {
    if (event.type !== "agent.tool_use" || event.name !== "write") {
      continue;
    }

    const toolInput = event.input ?? {};
    const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : null;
    const content = typeof toolInput.content === "string" ? toolInput.content : null;
    if (!filePath || content === null) {
      continue;
    }

    const originalName = filePath.split("/").filter(Boolean).pop() ?? `agent-file-${event.id ?? crypto.randomUUID()}.txt`;
    if (existingNames.has(originalName)) {
      continue;
    }

    const file = await saveAgentGeneratedTextFile({
      userId: input.userId,
      roomId: input.roomId,
      agentId: input.agentId,
      agentRunId: input.agentRunId,
      originalName,
      content,
      source: {
        anthropicEventId: event.id ?? null,
        filePath,
        toolName: event.name,
      },
    });
    importedFiles.push(file);
    existingNames.add(originalName);
  }
  return importedFiles;
}

export function formatManagedAgentPrompt(
  input: AgentRunInput,
  agentName: string,
  mountedFiles: MountedAgentFile[] = [],
  fileMountError: string | null = null,
  memoryMountError: string | null = null,
) {
  const developmentObserver = isDevelopmentObserverContext(input.startupContext);
  return [
    "너는 School-X 교사연구회 AI Office의 업무방 봇이다.",
    "아래 앱 컨텍스트 안에서만 답하고, 확인되지 않은 내용은 추정하지 말고 확인 질문으로 남겨라.",
    "학생 개인정보, 민감정보, 계정/키/토큰은 출력하지 말고 필요한 경우 관리자 확인을 요청하라.",
    "방 요약, 메시지 검색, 파일 목록/읽기, 회의방 공유, 업무방 반입, 결정사항 기록, 할 일 생성, 장기 기억 제안이 필요하면 제공된 School-X custom tools를 사용하라.",
    "custom tool 결과가 ok:false이면 실패 이유를 사용자에게 짧게 설명하고, 권한이나 입력값을 다시 확인하라.",
    "업로드된 방 파일은 [마운트된 방 파일 JSON]의 mountPath에서 직접 읽을 수 있다.",
    "사용자가 파일, PDF, 문서, 표 분석을 요청하면 파일명만 보고 추정하지 말고 먼저 mountPath를 열어보고, 경로가 없거나 읽히지 않으면 read_room_file custom tool로 파일 내용을 확인한 뒤 답하라.",
    "사용자가 결정사항으로 남기라고 하거나 회의 결론이 명확하면 create_decision을 사용하고, 구체적 실행 항목이면 create_task_from_decision을 사용하라.",
    "업무방 결과를 메인 회의방으로 공유하라는 요청은 share_item_to_meeting, 메인 회의방 항목을 업무방으로 가져가라는 요청은 import_meeting_item_to_room을 사용하라.",
    fileMountError
      ? "주의: 이번 실행에서는 외부 API 문제로 파일 마운트가 실패했다. 파일 내용이 필요한 요청이면 사용자에게 잠시 후 재시도 또는 텍스트 발췌 제공을 요청하라."
      : null,
    memoryMountError
      ? "주의: 이번 실행에서는 Claude Memory Store 연결이 실패했다. 앱 컨텍스트의 방 요약과 thread 요약을 우선 사용하고, 필요한 과거 원문은 School-X search_room_messages 도구로 확인하라."
      : null,
    developmentObserver
      ? "현재 개발봇으로 호출되었다. 방 담당자와 도메인 봇의 대화를 제품 개선 근거로 읽고, 플랫폼 개선 기회, 구현 계획, 리스크, 전체 프로젝트 진행 상황을 구분해 답하라."
      : input.mode === "meeting_guest"
      ? "현재 메인 회의방에 게스트로 호출되었다. 메인방의 사람 발언과 다른 봇 발언을 모두 읽고, 네 담당 업무 관점의 의견, 우려, 다음 행동을 5문장 이내로 제안하라."
      : "현재 담당 업무방 상주 봇으로 응답한다. 실행 가능한 다음 단계와 필요한 자료를 명확히 구분하라.",
    "사용자가 파일, 문서, 표, 다운로드 가능한 산출물을 요청하면 컨테이너에 실제 파일을 생성하고 파일명과 경로를 답변에 포함하라.",
    "",
    `[봇] ${agentName}`,
    `[roomId] ${input.roomId}`,
    `[threadId] ${input.threadId}`,
    `[mode] ${input.mode}`,
    input.guestSourceRoomId ? `[guestSourceRoomId] ${input.guestSourceRoomId}` : null,
    "",
    "[마운트된 방 파일 JSON]",
    JSON.stringify(
      mountedFiles.map((file) => ({
        roomId: file.roomId,
        fileId: file.fileId,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        mountPath: file.mountPath,
      })),
      null,
      2,
    ),
    "",
    "[앱 컨텍스트 JSON]",
    JSON.stringify(input.startupContext ?? {}, null, 2),
    "",
    "[사용자 요청]",
    input.message,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function fileResourceRoomIds(input: AgentRunInput) {
  const roomIds = [input.roomId];
  if (input.mode === "meeting_guest" && input.guestSourceRoomId) {
    roomIds.push(input.guestSourceRoomId);
  }
  const developmentHomeRoomId = getDevelopmentHomeRoomId(input.startupContext);
  if (developmentHomeRoomId) {
    roomIds.push(developmentHomeRoomId);
  }
  return [...new Set(roomIds)];
}

function isDevelopmentObserverContext(value: unknown) {
  return Boolean(getJsonObject(getJsonObject(value).developmentAgent).globalObserver);
}

function getDevelopmentHomeRoomId(value: unknown) {
  const roomId = getJsonObject(getJsonObject(value).developmentAgent).homeRoomId;
  return typeof roomId === "string" && roomId ? roomId : null;
}

function getJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function readEventStream(
  response: Response,
  signal: AbortSignal,
  onRequiresAction?: (blockingEvents: ManagedAgentEvent[]) => Promise<ManagedAgentEvent[]>,
  onEvent?: (event: ManagedAgentEvent) => Promise<void>,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    return [];
  }

  const decoder = new TextDecoder();
  const events: ManagedAgentEvent[] = [];
  const eventsById = new Map<string, ManagedAgentEvent>();
  const handledActionIds = new Set<string>();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\n\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const event = parseSseChunk(chunk);
      if (!event) {
        continue;
      }
      events.push(event);
      if (event.id) {
        eventsById.set(event.id, event);
      }
      await onEvent?.(event);
      if (event.type === "session.status_idle" && event.stop_reason?.type === "requires_action") {
        const blockingIds = event.stop_reason.event_ids ?? [];
        const pendingIds = blockingIds.filter((eventId) => !handledActionIds.has(eventId));
        if (!pendingIds.length) {
          continue;
        }
        if (!onRequiresAction) {
          return events;
        }

        const blockingEvents = pendingIds.map((eventId) => eventsById.get(eventId));
        if (blockingEvents.some((blockingEvent) => !blockingEvent)) {
          throw new Error(`Missing blocking tool event for requires_action: ${pendingIds.join(", ")}`);
        }

        const toolResultEvents = await onRequiresAction(blockingEvents as ManagedAgentEvent[]);
        pendingIds.forEach((eventId) => handledActionIds.add(eventId));
        events.push(...toolResultEvents);
        for (const toolResultEvent of toolResultEvents) {
          await onEvent?.(toolResultEvent);
        }
        continue;
      }
      if (event.type === "session.status_idle") {
        return events;
      }
      if (event.type === "session.error") {
        throw new Error(`Claude Managed Agent session error: ${JSON.stringify(event.error ?? event)}`);
      }
    }
  }

  return events;
}

function parseSseChunk(chunk: string): ManagedAgentEvent | null {
  const data = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!data || data === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(data) as ManagedAgentEvent;
  } catch {
    return { type: "managed_agent.unparseable_event", raw: data };
  }
}

function extractAgentText(events: ManagedAgentEvent[]) {
  return events
    .filter((event) => event.type === "agent.message")
    .flatMap((event) => event.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

function extractUsage(events: ManagedAgentEvent[]) {
  const latestUsage = [...events].reverse().find((event) => event.usage)?.usage;
  return latestUsage ?? {};
}

function sanitizeEvent(event: ManagedAgentEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
}

async function emitManagedEvent(input: AgentRunInput, event: ManagedAgentEvent) {
  await input.onEvent?.({
    type: event.type ?? "managed_agent.event",
    payload: sanitizeEvent(event),
  });
}

async function emitProgress(
  input: AgentRunInput,
  progress: { key: string; title: string; detail?: string | null },
) {
  await input.onEvent?.({
    type: AGENT_RUN_PROGRESS_EVENT,
    payload: agentRunProgressPayload(progress),
  });
}

async function emitProgressForManagedEvent(input: AgentRunInput, event: ManagedAgentEvent) {
  const progress = progressForManagedEvent(event);
  if (progress) {
    await emitProgress(input, progress);
  }
}

function progressForManagedEvent(event: ManagedAgentEvent) {
  if (event.type === "agent.message") {
    return {
      key: "answer",
      title: "응답 작성",
      detail: "사용자에게 보낼 답변을 정리하고 있습니다.",
    };
  }
  if (event.type === "agent.custom_tool_use" || event.type === "agent.tool_use") {
    return {
      key: `tool-${event.id ?? event.name ?? crypto.randomUUID()}`,
      title: "도구 실행",
      detail: friendlyToolName(event.name),
    };
  }
  if (event.type === "session.status_idle") {
    return {
      key: "session_idle",
      title: event.stop_reason?.type === "requires_action" ? "추가 도구 결과 대기" : "작업 정리",
      detail: null,
    };
  }
  return null;
}

function friendlyToolName(name: unknown) {
  if (typeof name !== "string" || !name) {
    return "도구 이름을 확인하지 못했습니다.";
  }

  const labels: Record<string, string> = {
    search_room_messages: "방 메시지 검색",
    read_room_file: "방 파일 읽기",
    list_room_files: "방 파일 목록 확인",
    share_item_to_meeting: "회의방 공유",
    import_meeting_item_to_room: "회의방 항목 가져오기",
    create_decision: "결정사항 기록",
    create_task_from_decision: "할 일 생성",
    propose_memory_update: "장기 기억 제안",
    write: "파일 작성",
  };
  return labels[name] ?? name;
}

function assertNotAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new Error("봇 실행이 중단되었습니다.");
  }
}

function windowlessTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms);
}
