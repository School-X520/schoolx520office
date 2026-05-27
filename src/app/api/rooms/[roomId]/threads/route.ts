import { jsonError, jsonOk } from "@/lib/api";
import { createRoomThread, listRoomThreads } from "@/server/rooms/thread-service";
import { requireUser } from "@/server/auth/require-user";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const threads = await listRoomThreads(user.userId, roomId);
    return jsonOk({ threads });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const thread = await createRoomThread(user.userId, roomId, body.title);
    return jsonOk({ thread }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
