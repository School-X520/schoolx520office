import "server-only";

import { cache } from "react";

import { shouldUseMockData } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { ForbiddenError } from "@/server/auth/errors";
import type { RoomRole } from "@/types/domain";

type LooseQuery = {
  select: (columns: string) => LooseQuery;
  eq: (column: string, value: string) => LooseQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
};

type LooseSupabase = {
  from: (table: string) => LooseQuery;
};

// 한 요청에서 같은 (userId, roomId) 멤버십을 여러 번 확인해도(예: 핸들러가
// requireRoomMember를 반복 호출) room_memberships 조회를 1회로 합친다.
export const getRoomMembership = cache(resolveRoomMembership);

async function resolveRoomMembership(userId: string, roomId: string) {
  if (shouldUseMockData()) {
    return mockStore.getMembership(userId, roomId);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data } = await (admin as unknown as LooseSupabase)
    .from("room_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("room_id", roomId)
    .maybeSingle();

  return data
    ? {
        userId: String(data.user_id),
        roomId: String(data.room_id),
        role: String(data.role) as RoomRole,
        joinedAt: String(data.joined_at),
      }
    : null;
}

export async function requireRoomMember(userId: string, roomId: string) {
  const membership = await getRoomMembership(userId, roomId);
  if (!membership) {
    throw new ForbiddenError("이 방에 접근할 권한이 없습니다.");
  }
  return membership;
}

export async function requireRoomAdmin(userId: string, roomId: string) {
  const membership = await requireRoomMember(userId, roomId);
  if (membership.role !== "admin") {
    throw new ForbiddenError("방 관리자 권한이 필요합니다.");
  }
  return membership;
}

export function canWriteRoom(role?: RoomRole | null) {
  return role === "admin" || role === "member";
}

// 호출자가 속한 방의 멤버십 목록을 mock/supabase 양 모드에서 동일하게 반환한다.
// (mockStore.listMemberships는 인자가 없어 전체를 반환하므로 user로 필터링한다.)
export async function listUserMemberships(userId: string) {
  if (shouldUseMockData()) {
    return mockStore.listMemberships().filter((membership) => membership.userId === userId);
  }
  return supabaseStore.listMemberships(userId);
}

// 호출자가 멤버인 방 id 집합. roomId가 지정되지 않은 목록 조회에서
// "내가 속한 방의 항목만" 필터링하는 데 쓴다(테넌트 격리).
export async function getUserRoomIds(userId: string): Promise<Set<string>> {
  const memberships = await listUserMemberships(userId);
  return new Set(memberships.map((membership) => membership.roomId));
}
