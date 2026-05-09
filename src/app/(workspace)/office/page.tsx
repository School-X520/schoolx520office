import { AppShell } from "@/components/layout/AppShell";
import { MeetingSidePanel } from "@/components/office/MeetingSidePanel";
import { OfficeFloorPlan } from "@/components/office/OfficeFloorPlan";
import { requireUser } from "@/server/auth/require-user";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";

export default async function OfficePage() {
  const user = await requireUser();
  const view = await getOfficeView(user.userId);
  const activeMeeting = mockStore.listVideoMeetings("meeting").find((meeting) => meeting.status !== "ended") ?? null;

  return (
    <AppShell
      user={user}
      rooms={view.rooms}
      memberships={view.memberships}
      showSidebar={false}
      fitViewport
      right={<MeetingSidePanel sharedItems={mockStore.listSharedItems("meeting")} activeMeeting={activeMeeting} />}
    >
      <OfficeFloorPlan rooms={view.rooms} agents={view.agents} memberships={view.memberships} />
    </AppShell>
  );
}
