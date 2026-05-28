import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import { shareFilesToRooms } from "@/server/collaboration/share-import-service";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      sourceRoomId?: string;
      sourceFileIds?: string[];
      targetRoomIds?: string[];
    };
    const result = await shareFilesToRooms({
      userId: user.userId,
      sourceRoomId: body.sourceRoomId?.trim() || "meeting",
      sourceFileIds: Array.isArray(body.sourceFileIds) ? body.sourceFileIds : [],
      targetRoomIds: Array.isArray(body.targetRoomIds) ? body.targetRoomIds : [],
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
