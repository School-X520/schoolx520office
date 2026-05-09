import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { mockStore } from "@/server/data/mock-store";
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

export async function getRoomMembership(userId: string, roomId: string) {
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
