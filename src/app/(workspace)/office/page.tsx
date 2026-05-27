import { AppShell } from "@/components/layout/AppShell";
import { MeetingSidePanel } from "@/components/office/MeetingSidePanel";
import { OfficeFloorPlan } from "@/components/office/OfficeFloorPlan";
import { shouldUseMockData } from "@/lib/env";
import { AuthError } from "@/server/auth/errors";
import { requireUser } from "@/server/auth/require-user";
import { redirectToLogin } from "@/server/auth/redirect-to-login";
import { getOfficeView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OfficePage() {
  const user = await requireUser().catch((error) => {
    if (error instanceof AuthError) {
      return redirectToLogin("/office");
    }
    throw error;
  });
  const source = shouldUseMockData() ? mockStore : supabaseStore;
  const [view, videoMeetings, sharedItems] = await Promise.all([
    getOfficeView(user.userId),
    source.listVideoMeetings("meeting"),
    source.listSharedItems("meeting"),
  ]);
  const activeMeeting = videoMeetings.find((meeting) => meeting.status !== "ended") ?? null;

  return (
    <AppShell
      user={user}
      rooms={view.rooms}
      memberships={view.memberships}
      showSidebar={false}
      fitViewport
      right={<MeetingSidePanel sharedItems={sharedItems} activeMeeting={activeMeeting} />}
    >
      <OfficeFloorPlan rooms={view.rooms} agents={view.agents} memberships={view.memberships} />
    </AppShell>
  );
}
