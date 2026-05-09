import { AppShell } from "@/components/layout/AppShell";
import { OpsDashboard } from "@/components/admin/OpsDashboard";
import { requireAdmin } from "@/server/auth/require-user";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";

export default async function OpsPage() {
  const user = await requireAdmin();
  const view = await getOfficeView(user.userId);
  return (
    <AppShell user={user} rooms={view.rooms} memberships={view.memberships}>
      <OpsDashboard
        agentRuns={mockStore.listAgentRuns()}
        auditLogs={mockStore.listAuditLogs()}
        memoryReviews={mockStore.listMemoryReviews()}
      />
    </AppShell>
  );
}
