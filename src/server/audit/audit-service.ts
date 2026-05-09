import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function writeAuditLog(input: Parameters<typeof mockStore.addAuditLog>[0]) {
  return shouldUseMockData() ? mockStore.addAuditLog(input) : supabaseStore.addAuditLog(input);
}
