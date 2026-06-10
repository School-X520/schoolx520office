import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { ForbiddenError } from "@/server/auth/errors";
import { statusError } from "@/lib/http-error";
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

const ZOOM_MEETING_NUMBER_PATTERN = /^\d{8,15}$/;
const joinableMeetingStatuses = new Set(["scheduled", "live"]);

// Zoom SDK 서명은 등록된 회의 + 해당 방 멤버에게만 발급한다.
// 검증 없이 발급하면 우리 SDK 키로 임의 Zoom 회의에 참가할 수 있는 서명이 무한 발급된다.
export async function assertCanJoinZoomMeeting(userId: string, meetingNumberInput: unknown) {
  const meetingNumber = typeof meetingNumberInput === "string" ? meetingNumberInput.trim() : "";
  if (!ZOOM_MEETING_NUMBER_PATTERN.test(meetingNumber)) {
    throw statusError("유효한 Zoom 회의 번호가 필요합니다.", 400);
  }

  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meetings = await source.listVideoMeetings();
  const meeting = meetings.find(
    (item) =>
      item.provider === "zoom" &&
      (item.providerMeetingId === meetingNumber || item.providerMeetingCode === meetingNumber),
  );
  if (!meeting) {
    throw statusError("등록된 Zoom 회의를 찾을 수 없습니다.", 404);
  }
  if (!joinableMeetingStatuses.has(meeting.status)) {
    throw statusError("이미 종료되었거나 참여할 수 없는 회의입니다.", 409);
  }

  await requireRoomMember(userId, meeting.roomId);
  return { meeting, meetingNumber };
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
