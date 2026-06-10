import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { parseJsonBody } from "@/lib/parse-json-body";
import { shouldUseMockData } from "@/lib/env";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { statusError } from "@/lib/http-error";

const decisionUpdateSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
});

async function requireMeetingDecisionEditor(userId: string, decisionId: string) {
  const membership = await requireRoomMember(userId, "meeting");
  if (!canWriteRoom(membership.role)) {
    throw statusError("결정사항을 수정할 권한이 없습니다.", 403);
  }
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const decision = (await source.listDecisions("meeting")).find((item) => item.id === decisionId);
  if (!decision) {
    throw statusError("결정사항을 찾을 수 없습니다.", 404);
  }
  return { source, decision };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { source, decision } = await requireMeetingDecisionEditor(user.userId, id);
    const body = await parseJsonBody(request, decisionUpdateSchema);
    const title = body.title?.trim();
    if (!title) {
      throw statusError("결정사항 제목이 필요합니다.", 400);
    }
    const updated = await source.updateDecision(decision.id, {
      title,
      description: body.description?.trim() || null,
    });
    await source.addAuditLog({
      actorUserId: user.userId,
      roomId: "meeting",
      action: "decision.updated",
      targetType: "decision",
      targetId: decision.id,
    });
    return jsonOk({ decision: updated });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { source, decision } = await requireMeetingDecisionEditor(user.userId, id);
    await source.deleteDecision(decision.id);
    await source.addAuditLog({
      actorUserId: user.userId,
      roomId: "meeting",
      action: "decision.deleted",
      targetType: "decision",
      targetId: decision.id,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
