import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { createRoomMessage } from "@/server/messages/room-message-service";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { resolveRoomThread } from "@/server/rooms/thread-service";

export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    await requireRoomMember(user.userId, roomId);
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const threadId = new URL(request.url).searchParams.get("threadId");
    const thread = await resolveRoomThread(user.userId, roomId, threadId);
    return jsonOk({ messages: await source.listMessages(roomId, thread.id), thread, user });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json()) as { content?: string; threadId?: string };
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
