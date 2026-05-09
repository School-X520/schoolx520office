import { jsonError, jsonOk } from "@/lib/api";
import { importMeetingMessageToRoom } from "@/server/collaboration/share-import-service";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";

export async function GET() {
  return jsonOk({ imports: mockStore.listImports() });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      targetRoomId?: string;
      sharedItemId?: string;
      sourceMessageId?: string;
      sourceFileId?: string;
      summary?: string;
    };
    const item = await importMeetingMessageToRoom({
      userId: user.userId,
      targetRoomId: body.targetRoomId ?? "research",
      sharedItemId: body.sharedItemId,
      sourceMessageId: body.sourceMessageId,
      sourceFileId: body.sourceFileId,
      summary: body.summary,
    });
    return jsonOk({ meetingImport: item });
  } catch (error) {
    return jsonError(error);
  }
}
