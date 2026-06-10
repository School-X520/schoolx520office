import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { requireUser } from "@/server/auth/require-user";
import { shareFilesToRooms } from "@/server/collaboration/share-import-service";

const shareBodySchema = z.object({
  sourceRoomId: z.string().max(64).optional(),
  sourceFileIds: z.array(z.string().max(128)).max(50).optional(),
  targetRoomIds: z.array(z.string().max(64)).max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request, shareBodySchema);
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
