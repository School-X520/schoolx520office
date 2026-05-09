import { jsonError, jsonOk } from "@/lib/api";
import { shareMessageToMeeting } from "@/server/collaboration/share-import-service";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";

export async function GET() {
  return jsonOk({ sharedItems: mockStore.listSharedItems() });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      sourceRoomId?: string;
      sourceMessageId?: string;
      sourceFileId?: string;
      title?: string;
      summary?: string;
    };
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
