import { describe, expect, it } from "vitest";

import { assertCanJoinZoomMeeting } from "@/lib/video-meetings/permissions";
import { mockStore } from "@/server/data/mock-store";

const MEMBER_ID = "zoom-access-member";
const OUTSIDER_ID = "zoom-access-outsider";

function createZoomMeeting(input: { providerMeetingId?: string; providerMeetingCode?: string; status: "scheduled" | "live" | "ended" }) {
  return mockStore.createVideoMeeting({
    roomId: "meeting",
    provider: "zoom",
    title: "Zoom 서명 검증 테스트 회의",
    providerMeetingId: input.providerMeetingId ?? null,
    providerMeetingCode: input.providerMeetingCode ?? null,
    status: input.status,
    createdBy: MEMBER_ID,
    consentRecording: false,
    consentTranscript: false,
    consentAiSummary: true,
  });
}

describe("assertCanJoinZoomMeeting", () => {
  it("형식이 잘못된 회의 번호를 400으로 거부한다", async () => {
    await expect(assertCanJoinZoomMeeting(MEMBER_ID, "not-a-number")).rejects.toMatchObject({ status: 400 });
    await expect(assertCanJoinZoomMeeting(MEMBER_ID, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(assertCanJoinZoomMeeting(MEMBER_ID, "123")).rejects.toMatchObject({ status: 400 });
  });

  it("등록되지 않은 회의 번호를 404로 거부한다", async () => {
    mockStore.upsertMembership({ userId: MEMBER_ID, roomId: "meeting", role: "member" });
    await expect(assertCanJoinZoomMeeting(MEMBER_ID, "99999999999")).rejects.toMatchObject({ status: 404 });
  });

  it("등록된 회의는 방 멤버에게만 허용한다", async () => {
    mockStore.upsertMembership({ userId: MEMBER_ID, roomId: "meeting", role: "member" });
    const meeting = createZoomMeeting({ providerMeetingId: "12345678901", status: "live" });

    const access = await assertCanJoinZoomMeeting(MEMBER_ID, "12345678901");
    expect(access.meeting.id).toBe(meeting.id);
    expect(access.meetingNumber).toBe("12345678901");

    await expect(assertCanJoinZoomMeeting(OUTSIDER_ID, "12345678901")).rejects.toMatchObject({ status: 403 });
  });

  it("providerMeetingCode로도 회의를 찾는다", async () => {
    mockStore.upsertMembership({ userId: MEMBER_ID, roomId: "meeting", role: "member" });
    const meeting = createZoomMeeting({ providerMeetingCode: "31415926535", status: "scheduled" });

    const access = await assertCanJoinZoomMeeting(MEMBER_ID, "31415926535");
    expect(access.meeting.id).toBe(meeting.id);
  });

  it("종료된 회의는 409로 거부한다", async () => {
    mockStore.upsertMembership({ userId: MEMBER_ID, roomId: "meeting", role: "member" });
    createZoomMeeting({ providerMeetingId: "22222222222", status: "ended" });

    await expect(assertCanJoinZoomMeeting(MEMBER_ID, "22222222222")).rejects.toMatchObject({ status: 409 });
  });
});
