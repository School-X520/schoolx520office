import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { AnthropicApiError, getManagedAgentsClientFromEnv } from "@/lib/anthropic/managed-agents-api";
import { getManagedAgentToolConfigs } from "@/server/agents/tools/tool-registry";
import { requireRoomAdmin, requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { Agent, AgentPersona } from "@/types/domain";

type PersonaPublishStatus = "anthropic_updated" | "local_only" | "anthropic_skipped";

function getSource() {
  return shouldUseMockData() ? mockStore : supabaseStore;
}

export async function getRoomAgentPersona(userId: string, roomId: string) {
  await requireRoomMember(userId, roomId);
  const source = getSource();
  const agent = await source.getAgentByRoom(roomId);
  if (!agent) {
    const error = new Error("이 방에 연결된 봇이 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }
  return {
    agent,
    persona: normalizeAgentPersona(agent.personaDraft, defaultAgentPersona(agent)),
    publishedPersona: normalizeAgentPersona(agent.personaPublished, defaultAgentPersona(agent)),
  };
}

export async function saveRoomAgentPersonaDraft(userId: string, roomId: string, rawPersona: unknown) {
  await requireRoomAdmin(userId, roomId);
  const source = getSource();
  const agent = await source.getAgentByRoom(roomId);
  if (!agent) {
    const error = new Error("이 방에 연결된 봇이 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const persona = normalizeAgentPersona(rawPersona, defaultAgentPersona(agent));
  const updatedAgent = await source.updateAgentPersona(agent.id, {
    personaDraft: persona,
    updatedBy: userId,
  });

  await source.addAuditLog({
    actorUserId: userId,
    actorAgentId: agent.id,
    roomId,
    action: "agent.persona.draft_saved",
    targetType: "agent",
    targetId: agent.id,
  });

  return { agent: updatedAgent ?? agent, persona };
}

export async function publishRoomAgentPersona(userId: string, roomId: string, rawPersona?: unknown) {
  await requireRoomAdmin(userId, roomId);
  const source = getSource();
  const agent = await source.getAgentByRoom(roomId);
  if (!agent) {
    const error = new Error("이 방에 연결된 봇이 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const persona = normalizeAgentPersona(rawPersona ?? agent.personaDraft, defaultAgentPersona(agent));
  const remote = await updateAnthropicAgentPersona(agent, persona);
  const versionNo = nextPersonaVersion(agent);
  const updatedAgent = await source.updateAgentPersona(agent.id, {
    personaDraft: persona,
    personaPublished: persona,
    updatedBy: userId,
    publishedBy: userId,
    anthropicAgentVersion: remote.anthropicAgentVersion ?? null,
    metadata: {
      persona_revision: versionNo,
      persona_published_status: remote.status,
      persona_published_at: new Date().toISOString(),
    },
  });

  await source.addAgentPersonaVersion({
    agentId: agent.id,
    roomId,
    versionNo,
    persona,
    anthropicAgentId: agent.anthropicAgentId ?? null,
    anthropicAgentVersion: remote.anthropicAgentVersion ?? null,
    publishedBy: userId,
    metadata: {
      publishStatus: remote.status,
      skippedReason: remote.skippedReason ?? null,
    },
  });

  await source.addAuditLog({
    actorUserId: userId,
    actorAgentId: agent.id,
    roomId,
    action: "agent.persona.published",
    targetType: "agent",
    targetId: agent.id,
    metadata: {
      publishStatus: remote.status,
      anthropicAgentVersion: remote.anthropicAgentVersion ?? null,
      skippedReason: remote.skippedReason ?? null,
    },
  });

  return {
    agent: updatedAgent ?? agent,
    persona,
    publishStatus: remote.status,
    skippedReason: remote.skippedReason ?? null,
    anthropicAgentVersion: remote.anthropicAgentVersion ?? null,
  };
}

export function defaultAgentPersona(agent: Pick<Agent, "name" | "role" | "systemPrompt" | "guestPrompt">): AgentPersona {
  return {
    role: agent.systemPrompt || `${agent.role || agent.name}로 담당 업무를 총괄한다.`,
    tone: "신중하고 간결한 한국어로 답한다.",
    outputStyle: "먼저 결론을 짧게 말하고, 필요한 다음 행동을 bullet로 정리한다.",
    priorities: `${agent.role || agent.name}의 업무 목표, 일정, 산출물 품질을 우선한다.`,
    boundaries: "학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.",
    customInstructions: "",
    guestPrompt: agent.guestPrompt || "회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.",
  };
}

export function normalizeAgentPersona(rawPersona: unknown, fallback: AgentPersona): AgentPersona {
  const source = rawPersona && typeof rawPersona === "object" && !Array.isArray(rawPersona)
    ? (rawPersona as Record<string, unknown>)
    : {};
  return {
    role: boundedText(source.role, fallback.role, 2000),
    tone: boundedText(source.tone, fallback.tone, 800),
    outputStyle: boundedText(source.outputStyle, fallback.outputStyle, 1200),
    priorities: boundedText(source.priorities, fallback.priorities, 1600),
    boundaries: boundedText(source.boundaries, fallback.boundaries, 1600),
    customInstructions: boundedText(source.customInstructions, fallback.customInstructions, 2500),
    guestPrompt: boundedText(source.guestPrompt, fallback.guestPrompt, 1200),
  };
}

export function buildAgentPersonaSystemPrompt(agent: Agent, persona: AgentPersona) {
  return [
    "담당자가 설정한 방별 페르소나:",
    `- 역할: ${persona.role}`,
    `- 말투: ${persona.tone}`,
    `- 응답 형식: ${persona.outputStyle}`,
    `- 우선순위: ${persona.priorities}`,
    `- 경계/금지: ${persona.boundaries}`,
    persona.customInstructions ? `- 추가 지시: ${persona.customInstructions}` : null,
    "",
    "공통 운영 원칙:",
    "- School-X 교사연구회 AI Office의 업무방 봇으로 행동한다.",
    "- 학생 개인정보, 계정, API 키, 내부 민감정보를 출력하지 않는다.",
    "- 앱이 전달한 방 요약, thread 요약, 최근 메시지, 사용자 요청을 우선 근거로 삼는다.",
    "- 모르는 내용은 추측하지 말고 확인 질문으로 남긴다.",
    "- 결정사항, 할 일, 공유 필요 항목은 짧고 실행 가능하게 정리한다.",
    "- 방 요약/메시지 검색/파일 목록/회의방 공유/업무방 반입/할 일 생성/장기 기억 제안은 제공된 School-X custom tools를 우선 사용한다.",
    "- 에이전트는 Supabase DB에 직접 접근하지 않고 School-X custom tool 결과만 신뢰한다.",
    "- 사용자가 파일, 문서, 표, 다운로드 가능한 산출물을 요청하면 텍스트로만 답하지 말고 컨테이너에 실제 파일을 생성하고 파일명과 경로를 답변에 포함한다.",
    "",
    "메인 회의방 게스트 호출 원칙:",
    persona.guestPrompt,
    "",
    `[School-X agent id] ${agent.id}`,
    `[School-X room id] ${agent.roomId}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function updateAnthropicAgentPersona(agent: Agent, persona: AgentPersona): Promise<{
  status: PersonaPublishStatus;
  anthropicAgentVersion?: number | null;
  skippedReason?: string;
}> {
  if (!agent.anthropicAgentId) {
    return { status: "local_only", skippedReason: "anthropic_agent_id_missing" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "anthropic_skipped", skippedReason: "anthropic_api_key_missing" };
  }

  const client = getManagedAgentsClientFromEnv();
  const remoteAgents = await client.listAgents();
  const remoteAgent = remoteAgents.find((item) => item.id === agent.anthropicAgentId);
  const currentVersion = remoteAgent?.version ?? numericMetadata(agent.metadata.anthropic_agent_version) ?? 1;
  const updated = await client.updateAgent({
    agentId: agent.anthropicAgentId,
    version: currentVersion,
    name: `School-X ${agent.name}`,
    model: agent.defaultModel,
    system: buildAgentPersonaSystemPrompt(agent, persona),
    description: `${agent.name} for ${agent.roomId} room in School-X 교사연구회 AI Office.`,
    tools: getManagedAgentToolConfigs(),
    metadata: {
      app: "schoolx520office",
      schoolx_agent_id: agent.id,
      schoolx_room_id: agent.roomId,
      persona_source: "schoolx_room_admin",
    },
  });
  return { status: "anthropic_updated", anthropicAgentVersion: updated.version ?? null };
}

function boundedText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function numericMetadata(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nextPersonaVersion(agent: Agent) {
  const current = numericMetadata(agent.metadata.persona_revision);
  return (current ?? 0) + 1;
}

export function personaPublishErrorMessage(error: unknown) {
  if (error instanceof AnthropicApiError) {
    const requestId = error.requestId ? ` 요청 ID: ${error.requestId}` : "";
    return `Claude Managed Agent 페르소나 게시에 실패했습니다. (${error.method} ${error.path}, ${error.status})${requestId}`;
  }
  return error instanceof Error ? error.message : "페르소나 처리에 실패했습니다.";
}
