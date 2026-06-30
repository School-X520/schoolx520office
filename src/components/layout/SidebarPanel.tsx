import Link from "next/link";
import { Lock, DoorOpen } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import { cn } from "@/lib/utils/cn";
import type { Room, RoomMembership } from "@/types/domain";

export function SidebarPanel({
  rooms,
  memberships,
  activeRoomId,
}: {
  rooms: Room[];
  memberships: RoomMembership[];
  activeRoomId?: string | null;
}) {
  const memberRoomIds = new Set(memberships.map((item) => item.roomId));
  const departmentRooms = rooms.filter((room) => room.type === "department");
  const projectRooms = rooms.filter((room) => room.type === "project");
  const meetingRoom = rooms.find((room) => room.id === "meeting");

  return (
    <aside className="space-y-4">
      <WarmCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <DoorOpen className="size-4 text-sage" />
          작업실 네비게이션
        </div>
        <nav className="space-y-1">
          {meetingRoom ? (
            <RoomLink room={meetingRoom} active={activeRoomId === meetingRoom.id} accessible />
          ) : null}
          <p className="pt-3 text-xs font-semibold text-ink-soft">부서방</p>
          {departmentRooms.map((room) => (
            <RoomLink key={room.id} room={room} accessible={memberRoomIds.has(room.id)} active={activeRoomId === room.id} />
          ))}
          <p className="pt-3 text-xs font-semibold text-ink-soft">과제</p>
          {projectRooms.map((room) => (
            <RoomLink key={room.id} room={room} accessible={memberRoomIds.has(room.id)} active={activeRoomId === room.id} />
          ))}
        </nav>
      </WarmCard>
    </aside>
  );
}

function RoomLink({
  room,
  accessible,
  active,
}: {
  room: Room;
  accessible: boolean;
  active?: boolean;
}) {
  const className = cn(
    "motion-drill-link flex items-center justify-between rounded-md px-3 py-2 text-sm",
    active ? "bg-gold-soft text-ink" : "text-ink-soft hover:bg-card",
    !accessible && "opacity-55",
  );
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="motion-drill-icon">{room.icon}</span>
        <span className="truncate">{room.name}</span>
      </span>
      {!accessible ? <Lock className="size-3.5" /> : null}
    </>
  );

  if (!accessible) {
    return (
      <div aria-disabled="true" className={className}>
        {content}
      </div>
    );
  }

  return (
    <Link href={`/rooms/${room.id}`} className={className}>
      {content}
    </Link>
  );
}
