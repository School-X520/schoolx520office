import { jsonError, jsonOk } from "@/lib/api";
import { summarizeVideoMeeting } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const artifact = await summarizeVideoMeeting(user.userId, id);
    return jsonOk({ artifact });
  } catch (error) {
    return jsonError(error);
  }
}
