import { jsonError, jsonOk } from "@/lib/api";
import { addVideoMeetingArtifact } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as {
      artifactType?: "recording" | "transcript" | "transcript_entry" | "ai_summary" | "manual_minutes" | "provider_metadata";
      title?: string;
      content?: string;
      externalUrl?: string;
    };
    const artifact = await addVideoMeetingArtifact(user.userId, id, {
      artifactType: body.artifactType ?? "manual_minutes",
      title: body.title ?? "회의 결과물",
      content: body.content,
      externalUrl: body.externalUrl,
    });
    return jsonOk({ artifact });
  } catch (error) {
    return jsonError(error);
  }
}
