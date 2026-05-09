import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { StatusPill } from "@/components/layout/StatusPill";
import type { Agent, Room } from "@/types/domain";

export function RoomCard({
  room,
  agent,
  accessible,
  onlineCount = 1,
  featured,
}: {
  room: Room;
  agent?: Agent;
  accessible: boolean;
  onlineCount?: number;
  featured?: boolean;
}) {
  return (
    <Link
      href={accessible ? `/rooms/${room.id}` : "#"}
      aria-disabled={!accessible}
      className={`office-room-card group relative flex h-full min-h-28 flex-col justify-between overflow-hidden rounded-lg border border-line bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        featured ? "min-h-32 border-bronze/50 bg-gold-soft/55" : ""
      } ${accessible ? "" : "opacity-55"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="office-room-card-icon text-3xl" role="img" aria-label={room.name}>
          {room.icon}
        </span>
        {accessible ? (
          <StatusPill tone={room.type === "meeting" ? "gold" : "sage"}>
            <Users className="size-3" />
            {onlineCount}
          </StatusPill>
        ) : (
          <StatusPill tone="neutral">
            <Lock className="size-3" />
            잠김
          </StatusPill>
        )}
      </div>
      <div className="office-room-card-body space-y-2">
        <h3 className="text-base font-semibold text-balance text-ink">{room.name}</h3>
        <p className="office-room-card-desc line-clamp-2 text-sm text-pretty text-ink-soft">{room.description}</p>
        {agent ? <p className="office-room-card-meta truncate text-xs text-terracotta">{agent.name} 대기 중</p> : <p className="office-room-card-meta text-xs text-ink-soft">상주 봇 없음</p>}
      </div>
    </Link>
  );
}
