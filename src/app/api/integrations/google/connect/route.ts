import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";

export async function GET() {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    redirect("/admin/ops?google=setup-required");
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/meetings.space.readonly");
  url.searchParams.set("access_type", "offline");
  redirect(url.toString());
}
