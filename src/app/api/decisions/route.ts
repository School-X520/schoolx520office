import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shouldUseMockData } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { statusError } from "@/lib/http-error";

const decisionBodySchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    // 결정사항은 항상 메인 회의방('meeting') 스코프다. 인가 대상과 데이터 대상을
    // 일치시키기 위해 임의 roomId 분기를 두지 않고 meeting 멤버십만 강제한다.
    await requireRoomMember(user.userId, "meeting");
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    return jsonOk({ decisions: await source.listDecisions("meeting") });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request, decisionBodySchema);
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
