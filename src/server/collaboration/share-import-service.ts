import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";

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

  const item = await source.createSharedItem({
    sourceRoomId: input.sourceRoomId,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceFileId: input.sourceFileId ?? null,
    title: input.title,
    summary: input.summary,
    sharedBy: input.userId,
  });

  await source.createMessage({
    roomId: "meeting",
    type: "shared_item",
    content: `${item.title}\n\n${item.summary}`,
    senderUserId: input.userId,
    metadata: { sharedItemId: item.id, sourceRoomId: input.sourceRoomId },
  });

  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: input.sourceRoomId,
    action: "shared_item.created",
    targetType: "shared_item",
    targetId: item.id,
    metadata: { targetRoomId: "meeting" },
  });

  return item;
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
  await requireRoomMember(input.userId, input.targetRoomId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;

  const item = await source.createImport({
    targetRoomId: input.targetRoomId,
    sharedItemId: input.sharedItemId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceFileId: input.sourceFileId ?? null,
    importedBy: input.userId,
    metadata: { summary: input.summary ?? "회의방에서 업무방으로 가져온 항목입니다." },
  });
  if (!shouldUseMockData()) {
    await supabaseStore.appendPendingContext(item.targetRoomId, {
      type: "meeting_import",
      meetingImportId: item.id,
      title: "회의방에서 가져온 맥락",
      summary: input.summary ?? "회의방 항목을 업무방에 반영해야 합니다.",
    });
  }

  await source.createMessage({
    roomId: input.targetRoomId,
    type: "meeting_import",
    content: input.summary ?? "메인 회의방 항목을 이 방으로 가져왔습니다.",
    senderUserId: input.userId,
    metadata: { meetingImportId: item.id },
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
