import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { sanitizeVideoMeetingResponse } from "@/lib/video-meetings/permissions";
import { requireUser } from "@/server/auth/require-user";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const meeting = await source.getVideoMeeting(id);
    if (!meeting) {
      return jsonOk({ meeting: null }, { status: 404 });
    }
    await requireRoomMember(user.userId, meeting.roomId);
    return jsonOk({
      meeting: sanitizeVideoMeetingResponse(meeting),
      artifacts: await source.listVideoArtifacts(id),
    });
  } catch (error) {
    return jsonError(error);
  }
}
