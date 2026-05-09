import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { ForbiddenError } from "@/server/auth/errors";
import { getRoomMembership, requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function assertRoomMember(userId: string, roomId: string) {
  return requireRoomMember(userId, roomId);
}

export async function assertCanCreateVideoMeeting(userId: string, roomId: string) {
  const membership = await requireRoomMember(userId, roomId);
  if (membership.role === "observer") {
    throw new ForbiddenError("화상회의 생성 권한이 없습니다.");
  }
  return membership;
}

export async function assertCanEndVideoMeeting(userId: string, meetingId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meeting = await source.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  const membership = await getRoomMembership(userId, meeting.roomId);
  if (meeting.createdBy !== userId && membership?.role !== "admin") {
    throw new ForbiddenError("회의 종료 권한이 없습니다.");
  }
  return meeting;
}

export function sanitizeVideoMeetingResponse<T extends { hostUrl?: string | null }>(meeting: T) {
  const { hostUrl, ...safe } = meeting;
  void hostUrl;
  return safe;
}
