import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { copyRoomFileToRoom, downloadRoomFileToLocalAndOpen } from "@/server/files/file-service";
import type { FileRecord, JsonObject, MeetingImport } from "@/types/domain";

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

async function canWriteAnyRoom(userId: string, roomIds: Array<string | null | undefined>) {
  for (const roomId of roomIds.filter((id): id is string => Boolean(id))) {
    try {
      const membership = await requireRoomMember(userId, roomId);
      if (canWriteRoom(membership.role)) {
        return roomId;
      }
    } catch {
      // Try the next candidate room.
    }
  }
  return null;
}

function fileShareSummary(fileName: string, targetRoomName: string) {
  return `${fileName} 파일을 ${targetRoomName}에 공유합니다.`;
}

async function grantRoomFileAccess(input: {
  userId: string;
  fileId: string;
  sourceRoomId: string;
  targetRoomId: string;
  sharedItemId: string;
}) {
  if (shouldUseMockData()) {
    mockStore.grantFileAccess(input.targetRoomId, input.fileId, "read");
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
      room_id: input.targetRoomId,
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
    roomId: input.targetRoomId,
    action: input.targetRoomId === "meeting" ? "file.shared_to_meeting" : "file.shared_to_room",
    targetType: "file",
    targetId: input.fileId,
    metadata: {
      sourceRoomId: input.sourceRoomId,
      sharedItemId: input.sharedItemId,
      accessLevel: "read",
    },
  });
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
    await grantRoomFileAccess({
      userId: input.userId,
      fileId: sharedFile.id,
      sourceRoomId: input.sourceRoomId,
      targetRoomId: "meeting",
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

export async function listFileShareTargetRooms(input: {
  userId: string;
  sourceRoomId: string;
}) {
  await requireRoomMember(input.userId, input.sourceRoomId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [rooms, memberships] = await Promise.all([
    source.listRooms(),
    shouldUseMockData()
      ? Promise.resolve(mockStore.listMemberships().filter((membership) => membership.userId === input.userId))
      : supabaseStore.listMemberships(input.userId),
  ]);
  const roleByRoomId = new Map(memberships.map((membership) => [membership.roomId, membership.role]));
  return rooms
    .filter((room) => room.isActive && room.id !== input.sourceRoomId && canWriteRoom(roleByRoomId.get(room.id)))
    .map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      role: roleByRoomId.get(room.id),
    }));
}

export async function shareFilesToRooms(input: {
  userId: string;
  sourceRoomId: string;
  sourceFileIds: string[];
  targetRoomIds: string[];
}) {
  const sourceMembership = await requireRoomMember(input.userId, input.sourceRoomId);
  if (!canWriteRoom(sourceMembership.role)) {
    throw statusError("파일을 공유할 권한이 없습니다.", 403);
  }
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sourceRoom = await source.getRoom(input.sourceRoomId);
  const sourceRoomName = sourceRoom?.name ?? input.sourceRoomId;
  const fileIds = [...new Set(input.sourceFileIds.map((fileId) => fileId.trim()).filter(Boolean))];
  const targetRoomIds = [...new Set(input.targetRoomIds.map((roomId) => roomId.trim()).filter(Boolean))]
    .filter((roomId) => roomId !== input.sourceRoomId);

  if (!fileIds.length) {
    throw statusError("공유할 파일을 선택해 주세요.", 400);
  }
  if (!targetRoomIds.length) {
    throw statusError("공유할 방을 선택해 주세요.", 400);
  }

  const sourceFiles = await source.listFiles(input.sourceRoomId);
  const fileById = new Map(sourceFiles.map((file) => [file.id, file]));
  const missingFileId = fileIds.find((fileId) => !fileById.has(fileId));
  if (missingFileId) {
    throw statusError("공유할 파일을 찾을 수 없습니다.", 404);
  }

  const targetRooms = await Promise.all(
    targetRoomIds.map(async (targetRoomId) => {
      const membership = await requireRoomMember(input.userId, targetRoomId);
      if (!canWriteRoom(membership.role)) {
        throw statusError("선택한 방에 공유할 권한이 없습니다.", 403);
      }
      const room = await source.getRoom(targetRoomId);
      if (!room?.isActive) {
        throw statusError("공유할 수 없는 방이 포함되어 있습니다.", 400);
      }
      return room;
    }),
  );

  const sharedItems = [];
  for (const targetRoom of targetRooms) {
    for (const fileId of fileIds) {
      const file = fileById.get(fileId) as FileRecord;
      const summary = fileShareSummary(file.originalName, targetRoom.name);
      const item = await source.createSharedItem({
        sourceRoomId: input.sourceRoomId,
        targetRoomId: targetRoom.id,
        sourceFileId: file.id,
        title: file.originalName,
        summary,
        sharedBy: input.userId,
        metadata: {
          sourceRoomName,
          targetRoomName: targetRoom.name,
          shareKind: "direct_file_share",
        },
      });
      await grantRoomFileAccess({
        userId: input.userId,
        fileId: file.id,
        sourceRoomId: input.sourceRoomId,
        targetRoomId: targetRoom.id,
        sharedItemId: item.id,
      });
      await source.createMessage({
        roomId: targetRoom.id,
        type: "shared_item",
        content: `${item.title}\n\n${item.summary}`,
        senderUserId: input.userId,
        metadata: { sharedItemId: item.id, sourceRoomId: input.sourceRoomId, sourceFileId: file.id },
      });
      await source.addAuditLog({
        actorUserId: input.userId,
        roomId: input.sourceRoomId,
        action: "shared_item.created",
        targetType: "shared_item",
        targetId: item.id,
        metadata: {
          targetRoomId: targetRoom.id,
          sourceFileId: file.id,
          shareKind: "direct_file_share",
        },
      });
      sharedItems.push(item);
    }
  }

  return { sharedItems };
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

export async function deleteSharedItem(input: {
  userId: string;
  sharedItemId: string;
}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sharedItem = (await source.listSharedItems()).find((item) => item.id === input.sharedItemId);
  if (!sharedItem) {
    throw statusError("공유 항목을 찾을 수 없습니다.", 404);
  }
  const writableRoomId = await canWriteAnyRoom(input.userId, [sharedItem.targetRoomId, sharedItem.sourceRoomId]);
  if (!writableRoomId) {
    throw statusError("공유 항목을 삭제할 권한이 없습니다.", 403);
  }

  const deleted = await source.deleteSharedItem(sharedItem.id, input.userId);
  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: writableRoomId,
    action: "shared_item.deleted",
    targetType: "shared_item",
    targetId: sharedItem.id,
    metadata: {
      sourceRoomId: sharedItem.sourceRoomId,
      targetRoomId: sharedItem.targetRoomId,
      sourceFileId: sharedItem.sourceFileId,
    },
  });

  return { sharedItem: deleted };
}

export async function deleteMeetingImport(input: {
  userId: string;
  importId: string;
}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const item = (await source.listImports()).find((meetingImport) => meetingImport.id === input.importId);
  if (!item) {
    throw statusError("반입 항목을 찾을 수 없습니다.", 404);
  }
  const writableRoomId = await canWriteAnyRoom(input.userId, [item.targetRoomId, item.meetingRoomId]);
  if (!writableRoomId) {
    throw statusError("반입 항목을 삭제할 권한이 없습니다.", 403);
  }
  const processedContextIds = await markImportPendingContextProcessed({
    roomId: item.targetRoomId,
    meetingImportId: item.id,
  });
  const deleted = await source.updateImport(item.id, {
    status: "dismissed",
    metadata: {
      ...item.metadata,
      deletedAt: new Date().toISOString(),
      deletedBy: input.userId,
      processedContextIds,
    },
  });
  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: writableRoomId,
    action: "meeting_import.deleted",
    targetType: "meeting_import",
    targetId: item.id,
    metadata: {
      targetRoomId: item.targetRoomId,
      meetingRoomId: item.meetingRoomId,
      sourceFileId: item.sourceFileId,
      processedContextIds,
    },
  });

  return { meetingImport: deleted, processedContextIds };
}

export async function openSharedItemOriginal(input: {
  userId: string;
  sharedItemId: string;
  downloadDir?: string | null;
}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const sharedItem = (await source.listSharedItems()).find((item) => item.id === input.sharedItemId);
  if (!sharedItem) {
    throw statusError("공유 항목을 찾을 수 없습니다.", 404);
  }
  if (!sharedItem.sourceFileId) {
    throw statusError("연결된 원본 파일이 없습니다.", 404);
  }
  const candidateRoomIds = [...new Set([sharedItem.targetRoomId, sharedItem.sourceRoomId].filter(Boolean))];
  let downloadRoomId: string | null = null;
  for (const roomId of candidateRoomIds) {
    try {
      await requireRoomMember(input.userId, roomId);
      const files = await source.listFiles(roomId);
      if (files.some((file) => file.id === sharedItem.sourceFileId)) {
        downloadRoomId = roomId;
        break;
      }
    } catch {
      // Try the next room the shared item is associated with.
    }
  }
  if (!downloadRoomId) {
    throw statusError("원본 파일을 열 권한이 없거나 파일 접근 권한이 없습니다.", 403);
  }

  return downloadRoomFileToLocalAndOpen({
    userId: input.userId,
    roomId: downloadRoomId,
    fileId: sharedItem.sourceFileId,
    downloadDir: input.downloadDir,
  });
}
