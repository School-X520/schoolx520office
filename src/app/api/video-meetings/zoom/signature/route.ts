import { createHmac } from "crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { getServerEnv } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";

export async function POST(request: Request) {
  try {
    await requireUser();
    const env = getServerEnv();
    const body = (await request.json()) as { meetingNumber?: string; role?: number };
    if (!env.ZOOM_MEETING_SDK_KEY || !env.ZOOM_MEETING_SDK_SECRET) {
      return jsonOk({ signature: null, sdkKey: null, setupRequired: true });
    }
    const role = body.role === 1 ? 0 : 0;
    const timestamp = Date.now() - 30000;
    const msg = Buffer.from(`${env.ZOOM_MEETING_SDK_KEY}${body.meetingNumber}${timestamp}${role}`).toString("base64");
    const hash = createHmac("sha256", env.ZOOM_MEETING_SDK_SECRET).update(msg).digest("base64");
    const signature = Buffer.from(`${env.ZOOM_MEETING_SDK_KEY}.${body.meetingNumber}.${timestamp}.${role}.${hash}`).toString("base64");
    return jsonOk({ signature, sdkKey: env.ZOOM_MEETING_SDK_KEY });
  } catch (error) {
    return jsonError(error);
  }
}
