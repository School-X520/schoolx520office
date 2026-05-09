import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { createRoomMessage } from "@/server/messages/room-message-service";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    await requireRoomMember(user.userId, roomId);
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ messages: await source.listMessages(roomId), user });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json()) as { content?: string };
    const message = await createRoomMessage({
      userId: user.userId,
      roomId,
      content: body.content?.trim() || "",
    });
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error);
  }
}
