import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { copyRoomFileToRoom, downloadRoomFileToLocalAndOpen } from "@/server/files/file-service";
import type { JsonObject, MeetingImport } from "@/types/domain";

type DbError = { message: string };
type LooseDb = {
  from: (table: string) => {
    upsert: (
      value: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: DbError | null }>;
  };
};

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function meetingImportTitle(item: MeetingImport) {
  return textValue(item.metadata.sharedItemTitle) ?? textValue(item.metadata.title) ?? `${item.targetRoomId} 반입 항목`;
}

function meetingImportSummary(item: MeetingImport) {
  return textValue(item.metadata.summary) ?? "메인 회의방에서 업무방으로 가져온 항목입니다.";
}

function pendingContextIdsForImport(pendingContext: JsonObject[], meetingImportId: string) {
  return pendingContext
    .filter((context) => context.meetingImportId === meetingImportId)
    .map((context) => textValue(context.id))
    .filter((id): id is string => Boolean(id));
}

async function requireWritableImport(input: { userId: string; importId: string }) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const item = (await source.listImports()).find((meetingImport) => meetingImport.id === input.importId);
  if (!item) {
    throw statusError("반입 항목을 찾을 수 없습니다.", 404);
  }
  const membership = await requireRoomMember(input.userId, item.targetRoomId);
  if (!canWriteRoom(membership.role)) {
    throw statusError("반입 항목을 처리할 권한이 없습니다.", 403);
  }
  return { source, item };
}

async function markImportPendingContextProcessed(input: { roomId: string; meetingImportId: string }) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const memory = await source.getMemory(input.roomId);
  const contextIds = memory ? pendingContextIdsForImport(memory.pendingContext, input.meetingImportId) : [];
  if (contextIds.length) {
    await source.markPendingProcessed(input.roomId, contextIds);
  }
  return contextIds;
}

export async function shareMessageToMeeting(input: {
  userId: string;
  sourceRoomId: string;
  sourceMessageId?: string;
  sourceFileId?: string;
  title: string;
  summary: string;
}) {
  await requireRoomMember(input.userId, input.sourceRoomId);
  await requireRoomMember(input.userId, "meeting");
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sourceRoom = await source.getRoom(input.sourceRoomId);
  const sharedFile = input.sourceFileId
    ? (await source.listFiles(input.sourceRoomId)).find((file) => file.id === input.sourceFileId)
    : null;
  if (input.sourceFileId && !sharedFile) {
    const error = new Error("공유할 파일을 찾을 수 없습니다.") as Error & { status: number };
    error.status = 404;
    throw error;
  }

  const item = await source.createSharedItem({
    sourceRoomId: input.sourceRoomId,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceFileId: input.sourceFileId ?? null,
    title: input.title,
    summary: input.summary,
    sharedBy: input.userId,
    metadata: {
      sourceRoomName: sourceRoom?.name ?? input.sourceRoomId,
      targetRoomName: "메인 회의방",
    },
  });

  await source.createMessage({
    roomId: "meeting",
    type: "shared_item",
    content: `${item.title}\n\n${item.summary}`,
    senderUserId: input.userId,
    metadata: { sharedItemId: item.id, sourceRoomId: input.sourceRoomId },
  });

  if (sharedFile) {
    await grantMeetingFileAccess({
      userId: input.userId,
      fileId: sharedFile.id,
      sourceRoomId: input.sourceRoomId,
      sharedItemId: item.id,
    });
  }

  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: input.sourceRoomId,
    action: "shared_item.created",
    targetType: "shared_item",
    targetId: item.id,
    metadata: { targetRoomId: "meeting", sourceFileId: input.sourceFileId ?? null },
  });

  return item;
}

async function grantMeetingFileAccess(input: {
  userId: string;
  fileId: string;
  sourceRoomId: string;
  sharedItemId: string;
}) {
  if (shouldUseMockData()) {
    return;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const db = admin as unknown as LooseDb;
  const { error } = await db.from("file_room_access").upsert(
    {
      file_id: input.fileId,
      room_id: "meeting",
      access_level: "read",
      added_by: input.userId,
    },
    { onConflict: "file_id,room_id" },
  );
  if (error) {
    throw new Error(error.message);
  }

  await supabaseStore.addAuditLog({
    actorUserId: input.userId,
    roomId: "meeting",
    action: "file.shared_to_meeting",
    targetType: "file",
    targetId: input.fileId,
    metadata: {
      sourceRoomId: input.sourceRoomId,
      sharedItemId: input.sharedItemId,
      accessLevel: "read",
    },
  });
}

export async function importMeetingMessageToRoom(input: {
  userId: string;
  targetRoomId: string;
  sharedItemId?: string;
  sourceMessageId?: string;
  sourceFileId?: string;
  summary?: string;
}) {
  await requireRoomMember(input.userId, "meeting");
  const targetMembership = await requireRoomMember(input.userId, input.targetRoomId);
  if (!canWriteRoom(targetMembership.role)) {
    throw statusError("작업방으로 가져갈 권한이 없습니다.", 403);
  }
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sharedItem = input.sharedItemId
    ? (await source.listSharedItems("meeting")).find((item) => item.id === input.sharedItemId)
    : null;
  const originalSourceFileId = input.sourceFileId ?? sharedItem?.sourceFileId ?? null;
  const copiedFile = originalSourceFileId
    ? await copyRoomFileToRoom({
        userId: input.userId,
        sourceRoomId: "meeting",
        sourceFileId: originalSourceFileId,
        targetRoomId: input.targetRoomId,
      })
    : null;
  const summary = input.summary ?? sharedItem?.summary ?? "회의방에서 업무방으로 가져온 항목입니다.";

  const item = await source.createImport({
    targetRoomId: input.targetRoomId,
    sharedItemId: input.sharedItemId ?? sharedItem?.id ?? null,
    sourceMessageId: input.sourceMessageId ?? sharedItem?.sourceMessageId ?? null,
    sourceFileId: copiedFile?.id ?? originalSourceFileId,
    importedBy: input.userId,
    metadata: {
      summary,
      originalSourceFileId,
      copiedFileId: copiedFile?.id ?? null,
      sourceRoomId: sharedItem?.sourceRoomId ?? null,
      sourceRoomName: sharedItem?.sourceRoomName ?? sharedItem?.metadata.sourceRoomName ?? null,
      sharedItemTitle: sharedItem?.title ?? null,
    },
  });
  if (!shouldUseMockData()) {
    await supabaseStore.appendPendingContext(item.targetRoomId, {
      type: "meeting_import",
      meetingImportId: item.id,
      title: sharedItem?.title ?? "회의방에서 가져온 맥락",
      summary,
      copiedFileId: copiedFile?.id ?? null,
    });
  }

  await source.createMessage({
    roomId: input.targetRoomId,
    type: "meeting_import",
    content: copiedFile
      ? `${copiedFile.originalName} 파일을 메인 회의방에서 이 방으로 가져왔습니다.\n\n${summary}`
      : summary,
    senderUserId: input.userId,
    metadata: { meetingImportId: item.id, copiedFileId: copiedFile?.id ?? null },
  });

  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: input.targetRoomId,
    action: "meeting_import.created",
    targetType: "meeting_import",
    targetId: item.id,
  });

  return item;
}

export async function applyMeetingImportToBotMemory(input: {
  userId: string;
  importId: string;
}) {
  const { source, item } = await requireWritableImport(input);
  const processedContextIds = await markImportPendingContextProcessed({
    roomId: item.targetRoomId,
    meetingImportId: item.id,
  });
  const updatedImport = await source.updateImport(item.id, {
    status: "processed",
    metadata: {
      ...item.metadata,
      reflectedToBotAt: new Date().toISOString(),
      reflectedBy: input.userId,
      processedContextIds,
    },
  });

  await source.createMessage({
    roomId: item.targetRoomId,
    type: "system",
    content: `${meetingImportTitle(item)} 반입 항목을 봇 맥락에 반영했습니다.`,
    senderUserId: input.userId,
    metadata: { meetingImportId: item.id, action: "meeting_import.reflected_to_bot" },
  });
  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: item.targetRoomId,
    action: "meeting_import.reflected_to_bot",
    targetType: "meeting_import",
    targetId: item.id,
    metadata: { processedContextIds },
  });

  return { meetingImport: updatedImport, processedContextIds };
}

export async function createTaskFromMeetingImport(input: {
  userId: string;
  importId: string;
}) {
  const { source, item } = await requireWritableImport(input);
  const title = meetingImportTitle(item);
  const summary = meetingImportSummary(item);
  const task = await source.createTask({
    roomId: "meeting",
    title,
    description: summary,
    assigneeRoomId: item.targetRoomId,
    createdBy: input.userId,
  });
  const processedContextIds = await markImportPendingContextProcessed({
    roomId: item.targetRoomId,
    meetingImportId: item.id,
  });
  const updatedImport = await source.updateImport(item.id, {
    status: "processed",
    metadata: {
      ...item.metadata,
      taskId: task.id,
      convertedToTaskAt: new Date().toISOString(),
      convertedBy: input.userId,
      processedContextIds,
    },
  });

  await source.createMessage({
    roomId: item.targetRoomId,
    type: "system",
    content: `${title} 반입 항목을 할 일로 만들었습니다.`,
    senderUserId: input.userId,
    metadata: { meetingImportId: item.id, taskId: task.id, action: "meeting_import.converted_to_task" },
  });
  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: item.targetRoomId,
    action: "meeting_import.converted_to_task",
    targetType: "meeting_import",
    targetId: item.id,
    metadata: { taskId: task.id, processedContextIds },
  });

  return { meetingImport: updatedImport, task, processedContextIds };
}

export async function openSharedItemOriginal(input: {
  userId: string;
  sharedItemId: string;
  downloadDir?: string | null;
}) {
  await requireRoomMember(input.userId, "meeting");
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sharedItem = (await source.listSharedItems("meeting")).find((item) => item.id === input.sharedItemId);
  if (!sharedItem) {
    throw statusError("공유 항목을 찾을 수 없습니다.", 404);
  }
  if (!sharedItem.sourceFileId) {
    throw statusError("연결된 원본 파일이 없습니다.", 404);
  }

  return downloadRoomFileToLocalAndOpen({
    userId: input.userId,
    roomId: "meeting",
    fileId: sharedItem.sourceFileId,
    downloadDir: input.downloadDir,
  });
}
