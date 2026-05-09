import "server-only";

import { mockStore } from "@/server/data/mock-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { ForbiddenError } from "@/server/auth/errors";
import type { MessageType } from "@/types/domain";

export async function createRoomMessage(input: {
  userId: string;
  roomId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, unknown>;
}) {
  const membership = await requireRoomMember(input.userId, input.roomId);
  if (!canWriteRoom(membership.role)) {
    throw new ForbiddenError("메시지를 작성할 권한이 없습니다.");
  }

  const message = mockStore.createMessage({
    roomId: input.roomId,
    type: input.type ?? "human",
    content: input.content,
    senderUserId: input.userId,
    metadata: input.metadata ?? {},
  });

  mockStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "room_message.created",
    targetType: "room_message",
    targetId: message.id,
  });

  return message;
}
