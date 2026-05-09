import "server-only";

import { GoogleMeetProvider } from "@/lib/video-meetings/providers/google-meet";
import { ZoomProvider } from "@/lib/video-meetings/providers/zoom";
import type { VideoMeetingProvider } from "@/lib/video-meetings/provider";
import { auditVideoMeeting } from "@/lib/video-meetings/audit";
import {
  assertCanCreateVideoMeeting,
  assertCanEndVideoMeeting,
  assertRoomMember,
  sanitizeVideoMeetingResponse,
} from "@/lib/video-meetings/permissions";
import { runAgent } from "@/server/agents/run-agent";
import { mockStore } from "@/server/data/mock-store";
import type { CreateVideoMeetingInput } from "@/types/video-meeting";

function providerFor(id: string): VideoMeetingProvider {
  if (id === "zoom") {
    return new ZoomProvider();
  }
  return new GoogleMeetProvider();
}

export async function createVideoMeeting(userId: string, input: CreateVideoMeetingInput) {
  await assertCanCreateVideoMeeting(userId, input.roomId);
  const provider = providerFor(input.provider);
  const result = await provider.createMeeting(input);
  const meeting = mockStore.createVideoMeeting({
    ...input,
    createdBy: userId,
    providerSpaceName: result.providerSpaceName ?? null,
    providerConferenceName: result.providerConferenceName ?? null,
    providerMeetingId: result.providerMeetingId ?? null,
    providerMeetingCode: result.providerMeetingCode ?? null,
    joinUrl: result.joinUrl ?? null,
    hostUrl: result.hostUrl ?? null,
    embedAllowed: result.embedAllowed ?? false,
    metadata: result.metadata ?? {},
  });

  mockStore.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: input.roomId,
    eventType: "created",
    actorUserId: userId,
    payload: { provider: input.provider },
  });

  mockStore.createMessage({
    roomId: input.roomId,
    type: "video_meeting",
    content: `${input.title} 화상회의가 준비되었습니다.`,
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

export async function listVideoMeetings(userId: string, roomId: string, status?: string | null) {
  await assertRoomMember(userId, roomId);
  return mockStore.listVideoMeetings(roomId, status ?? undefined).map(sanitizeVideoMeetingResponse);
}

export async function endVideoMeeting(userId: string, meetingId: string) {
  const meeting = await assertCanEndVideoMeeting(userId, meetingId);
  const providerId = meeting.providerSpaceName ?? meeting.providerMeetingId ?? meeting.id;
  await providerFor(meeting.provider).endMeeting(providerId);
  const updated = mockStore.updateVideoMeeting(meeting.id, {
    status: "ended",
    endedAt: new Date().toISOString(),
    endedBy: userId,
  })!;
  mockStore.addVideoEvent({
    videoMeetingId: meeting.id,
    roomId: meeting.roomId,
    eventType: "ended",
    actorUserId: userId,
  });
  mockStore.createMessage({
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
  const meeting = mockStore.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  await assertRoomMember(userId, meeting.roomId);
  const artifact = mockStore.addVideoArtifact({
    videoMeetingId: meetingId,
    artifactType: input.artifactType,
    title: input.title,
    content: input.content ?? null,
    externalUrl: input.externalUrl ?? null,
    createdBy: userId,
  });
  mockStore.addVideoEvent({
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
  const meeting = mockStore.getVideoMeeting(meetingId);
  if (!meeting) {
    throw new Error("회의를 찾을 수 없습니다.");
  }
  await assertRoomMember(userId, meeting.roomId);
  const agent = mockStore.getAgentByRoom("development")!;
  const result = await runAgent({
    userId,
    roomId: meeting.roomId,
    agentId: agent.id,
    message: `${meeting.title} 화상회의 내용을 요약하고 결정사항과 할 일을 제안해줘.`,
    mode: "finalizer",
    runType: "video_meeting_summary",
  });
  const artifact = await addVideoMeetingArtifact(userId, meetingId, {
    artifactType: "ai_summary",
    title: `${meeting.title} AI 회의 요약`,
    content: result.outputMessage.content,
  });
  mockStore.addVideoEvent({
    videoMeetingId: meetingId,
    roomId: meeting.roomId,
    eventType: "summary_created",
    actorUserId: userId,
  });
  return artifact;
}
