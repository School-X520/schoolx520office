import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import { listFileShareTargetRooms } from "@/server/collaboration/share-import-service";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const sourceRoomId = new URL(request.url).searchParams.get("sourceRoomId") ?? "meeting";
    const rooms = await listFileShareTargetRooms({
      userId: user.userId,
      sourceRoomId,
    });
    return jsonOk({ rooms });
  } catch (error) {
    return jsonError(error);
  }
}
