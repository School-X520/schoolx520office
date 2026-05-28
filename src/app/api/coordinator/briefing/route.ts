import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import {
  generateCoordinatorBriefing,
  getCoordinatorBriefingSnapshot,
} from "@/server/coordinator/coordinator-briefing-service";

export async function GET() {
  try {
    const user = await requireUser();
    const snapshot = await getCoordinatorBriefingSnapshot(user);
    return jsonOk(snapshot, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const snapshot = await generateCoordinatorBriefing(user);
    return jsonOk(snapshot, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
