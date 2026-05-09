import { jsonError, jsonOk } from "@/lib/api";
import { createSignedDownloadUrl } from "@/server/files/file-service";
import { requireUser } from "@/server/auth/require-user";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const roomId = new URL(request.url).searchParams.get("roomId") ?? "meeting";
    const result = await createSignedDownloadUrl({ userId: user.userId, roomId, fileId: id });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
