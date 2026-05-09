import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { shouldUseMockData } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-user";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export default async function AdminPage() {
  const user = await requireAdmin();
  const view = await getOfficeView(user.userId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  return (
    <AppShell user={user} rooms={view.rooms} memberships={view.memberships}>
      <AdminDashboard
        allowedUsers={await source.listAllowedUsers()}
        memberships={await source.listMemberships()}
        rooms={await source.listRooms()}
      />
    </AppShell>
  );
}
