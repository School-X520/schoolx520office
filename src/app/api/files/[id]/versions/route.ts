import { jsonError, jsonOk } from "@/lib/api";
import { createFileVersion } from "@/server/files/file-service";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json()) as { roomId?: string; changeSummary?: string };
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
