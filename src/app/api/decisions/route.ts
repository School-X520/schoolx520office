import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { statusError } from "@/lib/http-error";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    if (roomId) {
      await requireRoomMember(user.userId, roomId);
    } else {
      await requireRoomMember(user.userId, "meeting");
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ decisions: await source.listDecisions("meeting") });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { title?: string; description?: string };
    const title = body.title?.trim();
    if (!title) {
      throw statusError("결정사항 제목이 필요합니다.", 400);
    }
    const membership = await requireRoomMember(user.userId, "meeting");
    if (!canWriteRoom(membership.role)) {
      throw statusError("결정사항을 추가할 권한이 없습니다.", 403);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const decision = await source.createDecision({
      roomId: "meeting",
      title,
      description: body.description?.trim() || null,
      decidedBy: user.userId,
    });
    await source.addAuditLog({
      actorUserId: user.userId,
      roomId: "meeting",
      action: "decision.created",
      targetType: "decision",
      targetId: decision.id,
    });
    return jsonOk({ decision });
  } catch (error) {
    return jsonError(error);
  }
}
