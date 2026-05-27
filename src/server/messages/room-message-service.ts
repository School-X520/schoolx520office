import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { ForbiddenError } from "@/server/auth/errors";
import { resolveRoomThread } from "@/server/rooms/thread-service";
import type { MessageType } from "@/types/domain";

export async function createRoomMessage(input: {
  userId: string;
  roomId: string;
  threadId?: string | null;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}) {
  const membership = await requireRoomMember(input.userId, input.roomId);
  if (!canWriteRoom(membership.role)) {
    throw new ForbiddenError("메시지를 작성할 권한이 없습니다.");
  }

  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const thread = await resolveRoomThread(input.userId, input.roomId, input.threadId);
  const message = await source.createMessage({
    roomId: input.roomId,
    threadId: thread.id,
    type: input.type ?? "human",
    content: input.content,
    senderUserId: input.userId,
    metadata: input.metadata ?? {},
  });

  await source.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "room_message.created",
    targetType: "room_message",
    targetId: message.id,
  });

  return message;
}
