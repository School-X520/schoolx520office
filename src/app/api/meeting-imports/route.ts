import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shouldUseMockData } from "@/lib/env";
import { importMeetingMessageToRoom } from "@/server/collaboration/share-import-service";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

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
    if (roomId) {
      await requireRoomMember(user.userId, roomId);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ imports: await source.listImports(roomId) });
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
