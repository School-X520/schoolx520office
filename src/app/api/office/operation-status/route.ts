import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import { getOperationStatus } from "@/server/office/operation-status-service";

export async function GET() {
  try {
    const user = await requireUser();
    const status = await getOperationStatus(user.userId);
    return jsonOk(
      { status },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
