import Link from "next/link";
import { Lock, DoorOpen } from "lucide-react";
import { WarmCard } from "@/components/layout/WarmCard";
import type { Room, RoomMembership } from "@/types/domain";

export function SidebarPanel({
  rooms,
  memberships,
}: {
  rooms: Room[];
  memberships: RoomMembership[];
}) {
  const memberRoomIds = new Set(memberships.map((item) => item.roomId));
  const departmentRooms = rooms.filter((room) => room.type === "department");
  const projectRooms = rooms.filter((room) => room.type === "project");

  return (
    <aside className="space-y-4">
      <WarmCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <DoorOpen className="size-4 text-sage" />
          작업실 네비게이션
        </div>
        <nav className="space-y-1">
          <RoomLink room={rooms.find((room) => room.id === "meeting")!} active accessible />
          <p className="pt-3 text-xs font-semibold text-ink-soft">부서방</p>
          {departmentRooms.map((room) => (
            <RoomLink key={room.id} room={room} accessible={memberRoomIds.has(room.id)} />
          ))}
          <p className="pt-3 text-xs font-semibold text-ink-soft">과제</p>
          {projectRooms.map((room) => (
            <RoomLink key={room.id} room={room} accessible={memberRoomIds.has(room.id)} />
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
  return (
    <Link
      href={accessible ? `/rooms/${room.id}` : "#"}
      aria-disabled={!accessible}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
        active ? "bg-gold-soft text-ink" : "text-ink-soft hover:bg-card"
      } ${accessible ? "" : "opacity-55"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span>{room.icon}</span>
        <span className="truncate">{room.name}</span>
      </span>
      {!accessible ? <Lock className="size-3.5" /> : null}
    </Link>
  );
}
