import "server-only";

import { writeAuditLog } from "@/server/audit/audit-service";

export async function auditVideoMeeting(input: {
  userId: string;
  roomId: string;
  action:
    | "video_meeting.created"
    | "video_meeting.joined_intent"
    | "video_meeting.ended"
    | "video_meeting.artifact_created"
    | "video_meeting.consent_changed";
  meetingId: string;
  metadata?: Record<string, unknown>;
}) {
  return writeAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: input.action,
    targetType: "video_meeting",
    targetId: input.meetingId,
    metadata: input.metadata ?? {},
  });
}
