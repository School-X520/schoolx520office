import { createHmac } from "crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { getServerEnv } from "@/lib/env";
import { assertCanJoinZoomMeeting } from "@/lib/video-meetings/permissions";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getServerEnv();
    if (!env.ZOOM_MEETING_SDK_KEY || !env.ZOOM_MEETING_SDK_SECRET) {
      return jsonOk({ signature: null, sdkKey: null, setupRequired: true });
    }
    const body = (await request.json()) as { meetingNumber?: string; role?: number };
    const { meetingNumber } = await assertCanJoinZoomMeeting(user.userId, body.meetingNumber);
    // 호스트 서명(role=1)은 서버가 발급하지 않는다 — 항상 참가자 권한으로 고정.
    const role = 0;
    const timestamp = Date.now() - 30000;
    const msg = Buffer.from(`${env.ZOOM_MEETING_SDK_KEY}${meetingNumber}${timestamp}${role}`).toString("base64");
    const hash = createHmac("sha256", env.ZOOM_MEETING_SDK_SECRET).update(msg).digest("base64");
    const signature = Buffer.from(`${env.ZOOM_MEETING_SDK_KEY}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString("base64");
    return jsonOk({ signature, sdkKey: env.ZOOM_MEETING_SDK_KEY });
  } catch (error) {
    return jsonError(error);
  }
}
