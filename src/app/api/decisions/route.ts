import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    if (roomId) {
      await requireRoomMember(user.userId, roomId);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ decisions: await source.listDecisions(roomId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { roomId?: string; title?: string; description?: string };
    const roomId = body.roomId ?? "meeting";
    await requireRoomMember(user.userId, roomId);
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const decision = await source.createDecision({
      roomId,
      title: body.title ?? "새 결정사항",
      description: body.description ?? null,
      decidedBy: user.userId,
    });
    await source.addAuditLog({
      actorUserId: user.userId,
      roomId,
      action: "decision.created",
      targetType: "decision",
      targetId: decision.id,
    });
    return jsonOk({ decision });
  } catch (error) {
    return jsonError(error);
  }
}
