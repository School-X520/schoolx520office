import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { createFileVersion } from "@/server/files/file-service";
import { requireUser } from "@/server/auth/require-user";

const versionBodySchema = z.object({
  roomId: z.string().max(64).optional(),
  changeSummary: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseJsonBody(request, versionBodySchema);
    const file = await createFileVersion({
      userId: user.userId,
      roomId: body.roomId ?? "meeting",
      fileId: id,
      changeSummary: body.changeSummary ?? "새 버전",
    });
    return jsonOk({ file });
  } catch (error) {
    return jsonError(error);
  }
}
