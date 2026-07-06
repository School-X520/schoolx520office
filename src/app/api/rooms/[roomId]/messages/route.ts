import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shouldUseMockData } from "@/lib/env";
import { createRoomMessage } from "@/server/messages/room-message-service";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { ROOM_MESSAGE_FETCH_LIMIT } from "@/server/data/data-store";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { resolveRoomThread } from "@/server/rooms/thread-service";

const messageBodySchema = z.object({
  content: z.string().max(8000).optional(),
  threadId: z.string().max(128).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    await requireRoomMember(user.userId, roomId);
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const threadId = new URL(request.url).searchParams.get("threadId");
    const thread = await resolveRoomThread(user.userId, roomId, threadId);
    return jsonOk({
      messages: await source.listMessages(roomId, thread.id, { limit: ROOM_MESSAGE_FETCH_LIMIT }),
      thread,
      user,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = await parseJsonBody(request, messageBodySchema);
    const message = await createRoomMessage({
      userId: user.userId,
      roomId,
      threadId: body.threadId ?? null,
      content: body.content?.trim() || "",
    });
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error);
  }
}
