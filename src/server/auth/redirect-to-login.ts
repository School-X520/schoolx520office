import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isDevLoginEnabledForHost } from "@/server/auth/dev-login";

export async function redirectToLogin(nextPath: string): Promise<never> {
  const requestHeaders = await headers();
  if (isDevLoginEnabledForHost(requestHeaders.get("host"))) {
    redirect(`/auth/dev-login?next=${encodeURIComponent(nextPath)}`);
  }

  redirect("/login");
}
