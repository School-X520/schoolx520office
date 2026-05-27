import { jsonError, jsonOk } from "@/lib/api";
import { updateRoomThread } from "@/server/rooms/thread-service";
import { requireUser } from "@/server/auth/require-user";
import type { RoomThread } from "@/types/domain";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string; threadId: string }> },
) {
  try {
    const { roomId, threadId } = await params;
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      summary?: string;
      carryoverSummary?: string;
      status?: RoomThread["status"];
    };
    const thread = await updateRoomThread(user.userId, roomId, threadId, {
      title: body.title,
      summary: body.summary,
      carryoverSummary: body.carryoverSummary,
      status: body.status,
    });
    return jsonOk({ thread });
  } catch (error) {
    return jsonError(error);
  }
}
