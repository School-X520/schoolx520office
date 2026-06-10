import { jsonError, jsonOk } from "@/lib/api";
import { getAgentRunDetail } from "@/server/agents/get-agent-run-detail";
import { cancelAgentRun } from "@/server/agents/run-agent";
import { requireUser } from "@/server/auth/require-user";

export async function GET(_: Request, { params }: { params: Promise<{ roomId: string; runId: string }> }) {
  try {
    const { roomId, runId } = await params;
    const user = await requireUser();
    const detail = await getAgentRunDetail({ userId: user.userId, roomId, runId });
    return jsonOk(detail, noStoreJsonInit);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ roomId: string; runId: string }> }) {
  try {
    const { roomId, runId } = await params;
    const user = await requireUser();
    const result = await cancelAgentRun({
      userId: user.userId,
      roomId,
      runId,
    });

    return jsonOk(result, noStoreJsonInit);
  } catch (error) {
    return jsonError(error);
  }
}

const noStoreJsonInit = {
  headers: {
    "cache-control": "no-store",
  },
} satisfies ResponseInit;
