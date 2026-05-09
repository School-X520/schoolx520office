import { jsonError, jsonOk } from "@/lib/api";
import { createVideoMeeting, listVideoMeetings } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId") ?? "meeting";
    const status = url.searchParams.get("status");
    const meetings = await listVideoMeetings(user.userId, roomId, status);
    return jsonOk({ meetings });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      roomId?: string;
      provider?: "google_meet" | "zoom";
      title?: string;
      description?: string;
      consentRecording?: boolean;
      consentTranscript?: boolean;
      consentAiSummary?: boolean;
    };
    const meeting = await createVideoMeeting(user.userId, {
      roomId: body.roomId ?? "meeting",
      provider: body.provider ?? "google_meet",
      title: body.title ?? "정기 회의",
      description: body.description,
      consentRecording: Boolean(body.consentRecording),
      consentTranscript: Boolean(body.consentTranscript),
      consentAiSummary: body.consentAiSummary ?? true,
    });
    return jsonOk({ meeting });
  } catch (error) {
    return jsonError(error);
  }
}
