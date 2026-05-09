import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { requireAdmin } from "@/server/auth/require-user";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";

export default async function AdminPage() {
  const user = await requireAdmin();
  const view = await getOfficeView(user.userId);
  return (
    <AppShell user={user} rooms={view.rooms} memberships={view.memberships}>
      <AdminDashboard
        allowedUsers={mockStore.listAllowedUsers()}
        memberships={mockStore.listMemberships()}
        rooms={mockStore.listRooms()}
      />
    </AppShell>
  );
}
