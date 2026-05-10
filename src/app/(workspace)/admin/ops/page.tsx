import { AppShell } from "@/components/layout/AppShell";
import { OpsDashboard } from "@/components/admin/OpsDashboard";
import { shouldUseMockData } from "@/lib/env";
import { AuthError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-user";
import { redirectToLogin } from "@/server/auth/redirect-to-login";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OpsPage() {
  const user = await requireAdmin().catch((error) => {
    if (error instanceof AuthError) {
      return redirectToLogin("/admin/ops");
    }
    throw error;
  });
  const view = await getOfficeView(user.userId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  return (
    <AppShell user={user} rooms={view.rooms} memberships={view.memberships}>
      <OpsDashboard
        agentRuns={await source.listAgentRuns()}
        auditLogs={await source.listAuditLogs()}
        memoryReviews={await source.listMemoryReviews()}
      />
    </AppShell>
  );
}
