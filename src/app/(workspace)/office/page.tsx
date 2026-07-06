import { AppShell } from "@/components/layout/AppShell";
import { MeetingSidePanel } from "@/components/office/MeetingSidePanel";
import { OfficeFloorPlan } from "@/components/office/OfficeFloorPlan";
import { AuthError } from "@/server/auth/errors";
import { requireUser } from "@/server/auth/require-user";
import { redirectToLogin } from "@/server/auth/redirect-to-login";
import { getOfficeDashboard } from "@/server/rooms/get-room-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficePage() {
  const user = await requireUser().catch((error) => {
    if (error instanceof AuthError) {
      return redirectToLogin("/office");
    }
    throw error;
  });
  // 실 모드: rpc_office_view 1왕복으로 방·멤버십·에이전트·공유함·활성회의·운영카운트를 모두 조회.
  const dashboard = await getOfficeDashboard(user.userId);

  return (
    <AppShell
      user={user}
      rooms={dashboard.rooms}
      memberships={dashboard.memberships}
      showSidebar={false}
      fitViewport
      right={
        <MeetingSidePanel
          sharedItems={dashboard.sharedItems}
          activeMeeting={dashboard.activeMeeting}
          operationStatus={dashboard.operationStatus}
          accountEmail={user.email}
        />
      }
    >
      <OfficeFloorPlan rooms={dashboard.rooms} agents={dashboard.agents} memberships={dashboard.memberships} />
    </AppShell>
  );
}
