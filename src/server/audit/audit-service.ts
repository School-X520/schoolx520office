import "server-only";

import { mockStore } from "@/server/data/mock-store";

export async function writeAuditLog(input: Parameters<typeof mockStore.addAuditLog>[0]) {
  return mockStore.addAuditLog(input);
}
