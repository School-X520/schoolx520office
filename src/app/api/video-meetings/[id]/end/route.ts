import { jsonError, jsonOk } from "@/lib/api";
import { endVideoMeeting } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await endVideoMeeting(user.userId, id);
    return jsonOk({ meeting });
  } catch (error) {
    return jsonError(error);
  }
}
