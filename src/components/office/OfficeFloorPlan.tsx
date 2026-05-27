import { RoomCard } from "@/components/office/RoomCard";
import type { Agent, Room, RoomMembership } from "@/types/domain";

export function OfficeFloorPlan({
  rooms,
  agents,
  memberships,
}: {
  rooms: Room[];
  agents: Agent[];
  memberships: RoomMembership[];
}) {
  const access = new Set(memberships.map((item) => item.roomId));
  const agentByRoom = new Map(agents.map((agent) => [agent.roomId, agent]));
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const row = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Room[];

  return (
    <div className="office-floor h-full min-h-0">
      <div className="office-floor-panel flex h-full min-h-0 flex-col rounded-lg border border-line bg-paper-deep/60 p-4 shadow-sm">
        <div className="office-floor-heading mb-4 flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-balance">AI 협업 사무실 평면도</h1>
            <p className="text-sm text-pretty text-ink-soft">업무방에서 만든 산출물을 메인 회의방으로 모으고 다시 각 방으로 가져갑니다.</p>
          </div>
        </div>
        <div className="office-floor-grid grid min-h-0 flex-1 gap-4">
          <div className="grid min-h-0 gap-4 md:grid-cols-3">
            {row(["finance", "planning", "external"]).map((room) => (
              <RoomCard key={room.id} room={room} agent={agentByRoom.get(room.id)} accessible={access.has(room.id)} />
            ))}
          </div>
          <div className="relative grid min-h-0 gap-4 md:grid-cols-[1fr_1.25fr_1fr]">
            <Connector />
            <div className="hidden md:block" />
            <RoomCard room={byId.get("meeting")!} accessible={access.has("meeting")} featured />
            <div className="hidden md:block" />
          </div>
          <div className="grid min-h-0 gap-4 md:grid-cols-3">
            {row(["development", "research", "promotion"]).map((room) => (
              <RoomCard key={room.id} room={room} agent={agentByRoom.get(room.id)} accessible={access.has(room.id)} />
            ))}
          </div>
          <div className="grid min-h-0 gap-4 md:grid-cols-2">
            {row(["province_research", "science_museum"]).map((room) => (
              <RoomCard key={room.id} room={room} agent={agentByRoom.get(room.id)} accessible={access.has(room.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-10 top-1/2 hidden border-t border-dashed border-bronze/45 md:block"
    />
  );
}
