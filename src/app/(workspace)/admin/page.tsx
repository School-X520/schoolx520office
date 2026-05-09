import { AppShell } from "@/components/layout/AppShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { shouldUseMockData } from "@/lib/env";
import { AuthError } from "@/server/auth/errors";
import { requireAdmin } from "@/server/auth/require-user";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const user = await requireAdmin().catch((error) => {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  });
  const view = await getOfficeView(user.userId);
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  return (
    <AppShell user={user} rooms={view.rooms} memberships={view.memberships}>
      <AdminDashboard
        allowedUsers={await source.listAllowedUsers()}
        memberships={await source.listMemberships()}
        profiles={await source.listUserProfiles()}
        rooms={await source.listRooms()}
      />
    </AppShell>
  );
}
