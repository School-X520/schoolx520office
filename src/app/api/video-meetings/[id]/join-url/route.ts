import { jsonError, jsonOk } from "@/lib/api";
import { registerVideoMeetingJoinUrl } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as { joinUrl?: string };
    const meeting = await registerVideoMeetingJoinUrl(user.userId, id, body.joinUrl ?? "");
    return jsonOk({ meeting });
  } catch (error) {
    return jsonError(error);
  }
}
