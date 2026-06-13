import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { importMeetingMessageToRoom, listVisibleMeetingImports } from "@/server/collaboration/share-import-service";
import { requireUser } from "@/server/auth/require-user";

const importBodySchema = z.object({
  targetRoomId: z.string().max(64).optional(),
  targetRoomIds: z.array(z.string().max(64)).max(20).optional(),
  sharedItemId: z.string().max(128).optional(),
  sourceMessageId: z.string().max(128).optional(),
  sourceFileId: z.string().max(128).optional(),
  summary: z.string().max(4000).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    const imports = await listVisibleMeetingImports({ userId: user.userId, roomId });
    return jsonOk({ imports });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request, importBodySchema);
    const targetRoomIds = Array.isArray(body.targetRoomIds) && body.targetRoomIds.length
      ? [...new Set(body.targetRoomIds.filter(Boolean))]
      : [body.targetRoomId ?? "research"];
    const imports = await Promise.all(
      targetRoomIds.map((targetRoomId) =>
        importMeetingMessageToRoom({
          userId: user.userId,
          targetRoomId,
          sharedItemId: body.sharedItemId,
          sourceMessageId: body.sourceMessageId,
          sourceFileId: body.sourceFileId,
          summary: body.summary,
        }),
      ),
    );
    return jsonOk({ meetingImport: imports[0], imports });
  } catch (error) {
    return jsonError(error);
  }
}
