import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { registerVideoMeetingJoinUrl } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

const joinUrlBodySchema = z.object({
  joinUrl: z.string().max(2000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseJsonBody(request, joinUrlBodySchema);
    const meeting = await registerVideoMeetingJoinUrl(user.userId, id, body.joinUrl ?? "");
    return jsonOk({ meeting });
  } catch (error) {
    return jsonError(error);
  }
}
