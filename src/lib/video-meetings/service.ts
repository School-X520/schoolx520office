import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { isActiveVideoMeeting } from "@/lib/video-meetings/active";
import { normalizeGoogleMeetJoinUrl } from "@/lib/video-meetings/join-url";
import { GoogleMeetProvider } from "@/lib/video-meetings/providers/google-meet";
import { ZoomProvider } from "@/lib/video-meetings/providers/zoom";
import type { VideoMeetingProvider } from "@/lib/video-meetings/provider";
import { auditVideoMeeting } from "@/lib/video-meetings/audit";
import {
  assertCanCreateVideoMeeting,
  assertCanEndVideoMeeting,
  assertRoomMember,
  assertRoomWriter,
  sanitizeVideoMeetingResponse,
} from "@/lib/video-meetings/permissions";
import { runAgent } from "@/server/agents/run-agent";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { VideoMeeting } from "@/types/domain";
import type { CreateVideoMeetingInput } from "@/types/video-meeting";

function providerFor(id: string): VideoMeetingProvider {
  if (id === "zoom") {
    return new ZoomProvider();
  }
  return new GoogleMeetProvider();
}

type VideoMeetingSource = typeof mockStore | typeof supabaseStore;

async function getOpenVideoMeeting(source: VideoMeetingSource, roomId: string) {
  const meetings = await source.listVideoMeetings(roomId);
  return meetings.find((meeting: VideoMeeting) => isActiveVideoMeeting(meeting)) ?? null;
}

export async function createVideoMeeting(userId: string, input: CreateVideoMeetingInput) {
  await assertCanCreateVideoMeeting(userId, input.roomId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const openMeeting = await getOpenVideoMeeting(source, input.roomId);
  if (openMeeting) {
    await source.addVideoEvent({
      videoMeetingId: openMeeting.id,
      roomId: openMeeting.roomId,
      eventType: "joined_intent",
      actorUserId: userId,
      payload: { reusedExistingMeeting: true },
    });
    await auditVideoMeeting({
      userId,
      roomId: openMeeting.roomId,
      action: "video_meeting.joined_intent",
      meetingId: openMeeting.id,
      metadata: { reusedExistingMeeting: true },
    });
    return sanitizeVideoMeetingResponse(openMeeting);
  }

  const provider = providerFor(input.provider);
  const result = await provider.createMeeting(input);
  const startedAt = new Date().toISOString();
  const meeting = await source.createVideoMeeting({
    ...input,
    status: "live",
    startedAt,
    createdBy: userId,
    providerSpaceName: result.providerSpaceName ?? null,
    providerConferenceName: result.providerConferenceName ?? null,
    providerMeetingId: result.providerMeetingId ?? null,
    providerMeetingCode: result.providerMeetingCode ?? null,
    joinUrl: result.joinUrl ?? null,
    hostUrl: result.hostUrl ?? null,
    embedAllowed: result.embedAllowed ?? false,
    metadata: {
      ...(result.metadata ?? {}),
      firstOpenedBy: userId,
      firstOpenedAt: startedAt,
      activeJoinFlow: true,
    },
  });

  await source.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: input.roomId,
    eventType: "created",
    actorUserId: userId,
    payload: { provider: input.provider },
  });
  await source.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: input.roomId,
    eventType: "live",
    actorUserId: userId,
    payload: { provider: input.provider },
  });
  if (input.provider === "google_meet" && meeting.joinUrl && meeting.metadata.requiresJoinUrlRegistration !== true) {
    const autoRegisteredAt = new Date().toISOString();
    await source.addVideoEvent({
      videoMeetingId: meeting.id,
      roomId: input.roomId,
      eventType: "join_url_registered",
      actorUserId: userId,
      payload: { joinUrl: meeting.joinUrl, automatic: true },
    });
    await auditVideoMeeting({
      userId,
      roomId: input.roomId,
      action: "video_meeting.join_url_registered",
      meetingId: meeting.id,
      metadata: { joinUrlRegisteredAt: autoRegisteredAt, automatic: true },
    });
  }

  await source.createMessage({
    roomId: input.roomId,
    type: "video_meeting",
    content: `${input.title} 화상회의가 시작되었습니다. 대시보드에서 회의 참가 버튼으로 들어갈 수 있습니다.`,
    senderUserId: userId,
    metadata: { videoMeetingId: meeting.id, provider: input.provider },
  });

  await auditVideoMeeting({
    userId,
    roomId: input.roomId,
    action: "video_meeting.created",
    meetingId: meeting.id,
    metadata: {
      consentRecording: input.consentRecording,
      consentTranscript: input.consentTranscript,
      consentAiSummary: input.consentAiSummary,
    },
  });

  return sanitizeVideoMeetingResponse(meeting);
}

export async function joinVideoMeeting(userId: string, meetingId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meeting = await source.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  await assertRoomMember(userId, meeting.roomId);

  const joinedAt = new Date().toISOString();
  const currentMeeting =
    meeting.status === "scheduled"
      ? await source.updateVideoMeeting(meeting.id, {
          status: "live",
          startedAt: meeting.startedAt ?? joinedAt,
          metadata: {
            ...meeting.metadata,
            firstJoinedAt: meeting.startedAt ?? joinedAt,
          },
        })
      : meeting;

  await source.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: meeting.roomId,
    eventType: "joined_intent",
    actorUserId: userId,
    payload: { joinUrlPresent: Boolean(currentMeeting?.joinUrl) },
  });
  await auditVideoMeeting({
    userId,
    roomId: meeting.roomId,
    action: "video_meeting.joined_intent",
    meetingId: meeting.id,
    metadata: { joinUrlPresent: Boolean(currentMeeting?.joinUrl) },
  });

  return sanitizeVideoMeetingResponse(currentMeeting ?? meeting);
}

export async function registerVideoMeetingJoinUrl(userId: string, meetingId: string, inputUrl: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meeting = await source.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  await assertCanCreateVideoMeeting(userId, meeting.roomId);

  const joinUrl = normalizeGoogleMeetJoinUrl(inputUrl);
  if (!joinUrl) {
    throw new Error("Google Meet 주소는 https://meet.google.com/abc-defg-hij 형식이어야 합니다.");
  }

  const registeredAt = new Date().toISOString();
  const updated = await source.updateVideoMeeting(meeting.id, {
    joinUrl,
    metadata: {
      ...meeting.metadata,
      requiresJoinUrlRegistration: false,
      joinUrlRegisteredBy: userId,
      joinUrlRegisteredAt: registeredAt,
    },
  });
  await source.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: meeting.roomId,
    eventType: "join_url_registered",
    actorUserId: userId,
    payload: { joinUrl },
  });
  await auditVideoMeeting({
    userId,
    roomId: meeting.roomId,
    action: "video_meeting.join_url_registered",
    meetingId: meeting.id,
    metadata: { joinUrlRegisteredAt: registeredAt },
  });

  return sanitizeVideoMeetingResponse(updated ?? meeting);
}

export async function listVideoMeetings(userId: string, roomId: string, status?: string | null) {
  await assertRoomMember(userId, roomId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  return (await source.listVideoMeetings(roomId, status ?? undefined)).map(sanitizeVideoMeetingResponse);
}

export async function endVideoMeeting(userId: string, meetingId: string) {
  const meeting = await assertCanEndVideoMeeting(userId, meetingId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const providerId = meeting.providerSpaceName ?? meeting.providerMeetingId ?? meeting.id;
  await providerFor(meeting.provider).endMeeting(providerId);
  const updated = await source.updateVideoMeeting(meeting.id, {
    status: "ended",
    endedAt: new Date().toISOString(),
    endedBy: userId,
  })!;
  await source.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: meeting.roomId,
    eventType: "ended",
    actorUserId: userId,
  });
  await source.createMessage({
    roomId: meeting.roomId,
    type: "video_meeting",
    content: `${meeting.title} 화상회의가 종료되었습니다. 회의록 정리를 진행할 수 있습니다.`,
    senderUserId: userId,
    metadata: { videoMeetingId: meeting.id, status: "ended" },
  });
  await auditVideoMeeting({
    userId,
    roomId: meeting.roomId,
    action: "video_meeting.ended",
    meetingId: meeting.id,
  });
  return sanitizeVideoMeetingResponse(updated);
}

export async function addVideoMeetingArtifact(userId: string, meetingId: string, input: {
  artifactType: "recording" | "transcript" | "transcript_entry" | "ai_summary" | "manual_minutes" | "provider_metadata";
  title: string;
  content?: string;
  externalUrl?: string;
}) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meeting = await source.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  await assertRoomMember(userId, meeting.roomId);
  const artifact = await source.addVideoArtifact({
    videoMeetingId: meetingId,
    artifactType: input.artifactType,
    title: input.title,
    content: input.content ?? null,
    externalUrl: input.externalUrl ?? null,
    createdBy: userId,
  });
  await source.addVideoEvent({
    videoMeetingId: meetingId,
    roomId: meeting.roomId,
    eventType: "artifact_ready",
    actorUserId: userId,
    payload: { artifactType: input.artifactType },
  });
  await auditVideoMeeting({
    userId,
    roomId: meeting.roomId,
    action: "video_meeting.artifact_created",
    meetingId,
    metadata: { artifactType: input.artifactType },
  });
  return artifact;
}

export async function summarizeVideoMeeting(userId: string, meetingId: string) {
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const meeting = await source.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  // AI 요약은 비용을 유발하는 에이전트 실행 + 산출물 쓰기이므로 observer는 트리거할 수 없다.
  await assertRoomWriter(userId, meeting.roomId);
  const agent = await source.getAgentByRoom("development");
  if (!agent) {
    throw new Error("회의 요약 봇을 사용할 수 없습니다.");
  }
  const result = await runAgent({
    userId,
    roomId: meeting.roomId,
    agentId: agent.id,
    message: `${meeting.title} 화상회의 내용을 요약하고 결정사항과 할 일을 제안해줘.`,
    mode: "finalizer",
    runType: "video_meeting_summary",
  });
  if (!result.outputMessage) {
    throw new Error("회의 요약 메시지를 생성하지 못했습니다.");
  }
  const artifact = await addVideoMeetingArtifact(userId, meetingId, {
    artifactType: "ai_summary",
    title: `${meeting.title} AI 회의 요약`,
    content: result.outputMessage.content,
  });
  await source.addVideoEvent({
    videoMeetingId: meetingId,
    roomId: meeting.roomId,
    eventType: "summary_created",
    actorUserId: userId,
  });
  return artifact;
}
