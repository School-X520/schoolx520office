import type { ReactNode } from "react";
import { TopHeader } from "@/components/layout/TopHeader";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { cn } from "@/lib/utils/cn";
import type { Room, RoomMembership, UserProfile } from "@/types/domain";

export function AppShell({
  user,
  rooms,
  memberships,
  children,
  right,
  showSidebar = true,
  fitViewport = false,
  activeRoomId = null,
}: {
  user: UserProfile;
  rooms: Room[];
  memberships: RoomMembership[];
  children: ReactNode;
  right?: ReactNode;
  showSidebar?: boolean;
  fitViewport?: boolean;
  activeRoomId?: string | null;
}) {
  return (
    <div className={cn("min-h-dvh", fitViewport && "lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden")}>
      <TopHeader user={user} />
      <main
        className={cn(
          "mx-auto grid w-full gap-5 px-4 py-5",
          showSidebar
            ? "max-w-[1500px] lg:grid-cols-[18rem_minmax(0,1fr)_22rem]"
            : "max-w-[1780px] lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_27rem]",
          !right && !showSidebar && "lg:grid-cols-1",
          fitViewport && "lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:py-3",
        )}
      >
        {showSidebar ? <SidebarPanel rooms={rooms} memberships={memberships} activeRoomId={activeRoomId} /> : null}
        <section className={cn("min-w-0", fitViewport && "lg:h-full lg:min-h-0")}>{children}</section>
        {right ? <aside className={cn("min-w-0", fitViewport && "lg:h-full lg:min-h-0")}>{right}</aside> : null}
      </main>
    </div>
  );
}
