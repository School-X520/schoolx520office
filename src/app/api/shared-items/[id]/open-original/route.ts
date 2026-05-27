import { jsonError, jsonOk } from "@/lib/api";
import { openSharedItemOriginal } from "@/server/collaboration/share-import-service";
import { defaultLocalDownloadDir } from "@/server/files/file-service";
import { requireUser } from "@/server/auth/require-user";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    return jsonOk({ defaultDownloadDir: defaultLocalDownloadDir() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { downloadDir?: string };
    const result = await openSharedItemOriginal({
      userId: user.userId,
      sharedItemId: id,
      downloadDir: body.downloadDir,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
