import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { addVideoMeetingArtifact } from "@/lib/video-meetings/service";
import { requireUser } from "@/server/auth/require-user";

const artifactBodySchema = z.object({
  artifactType: z
    .enum(["recording", "transcript", "transcript_entry", "ai_summary", "manual_minutes", "provider_metadata"])
    .optional(),
  title: z.string().max(300).optional(),
  content: z.string().max(50_000).optional(),
  externalUrl: z
    .string()
    .max(2000)
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "http(s) URL만 허용됩니다.")
    .optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseJsonBody(request, artifactBodySchema);
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
