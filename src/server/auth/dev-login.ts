import "server-only";

export function isDevLoginEnabledForHost(host: string | null) {
  if (process.env.ENABLE_DEV_LOGIN !== "true") {
    return false;
  }

  const hostname = (host ?? "").split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getDevLoginEmail() {
  return (process.env.DEV_LOGIN_EMAIL ?? "school.x520@gmail.com").trim().toLowerCase();
}
