import { jsonError, jsonOk } from "@/lib/api";
import { deleteMeetingImport } from "@/server/collaboration/share-import-service";
import { requireUser } from "@/server/auth/require-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await deleteMeetingImport({
      userId: user.userId,
      importId: id,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
