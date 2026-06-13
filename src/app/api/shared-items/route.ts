import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { listVisibleSharedItems, shareMessageToMeeting } from "@/server/collaboration/share-import-service";
import { requireUser } from "@/server/auth/require-user";

const sharedItemBodySchema = z.object({
  sourceRoomId: z.string().max(64).optional(),
  sourceMessageId: z.string().max(128).optional(),
  sourceFileId: z.string().max(128).optional(),
  title: z.string().max(500).optional(),
  summary: z.string().max(4000).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    const sharedItems = await listVisibleSharedItems({ userId: user.userId, roomId });
    return jsonOk({ sharedItems });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request, sharedItemBodySchema);
    const item = await shareMessageToMeeting({
      userId: user.userId,
      sourceRoomId: body.sourceRoomId ?? "meeting",
      sourceMessageId: body.sourceMessageId,
      sourceFileId: body.sourceFileId,
      title: body.title ?? "공유 항목",
      summary: body.summary ?? "회의방으로 공유된 항목입니다.",
    });
    return jsonOk({ sharedItem: item });
  } catch (error) {
    return jsonError(error);
  }
}
