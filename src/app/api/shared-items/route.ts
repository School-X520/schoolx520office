import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { shareMessageToMeeting } from "@/server/collaboration/share-import-service";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    if (roomId) {
      await requireRoomMember(user.userId, roomId);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ sharedItems: await source.listSharedItems(roomId) });
  } catch (error) {
    return jsonError(error);
  }
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
