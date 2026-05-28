import { AgentPersonaEditor } from "@/components/agents/AgentPersonaEditor";
import { FileList } from "@/components/files/FileList";
import { WarmCard } from "@/components/layout/WarmCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import { DecisionTaskPanel } from "@/components/rooms/DecisionTaskPanel";
import type { Agent, Decision, DomainMemory, FileRecord, MeetingImport, Room, SharedItem, Task } from "@/types/domain";

export function RoomRightPanel({
  roomId,
  agent,
  canEditAgentPersona,
  memory,
  files,
  sharedItems,
  imports,
  decisions,
  tasks,
  taskTargetRooms,
}: {
  roomId: string;
  agent?: Agent;
  canEditAgentPersona: boolean;
  memory: DomainMemory;
  files: FileRecord[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  decisions: Decision[];
  tasks: Task[];
  taskTargetRooms: Room[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      {agent ? (
        <div className="motion-continuity-enter">
          <AgentPersonaEditor roomId={roomId} agent={agent} canEdit={canEditAgentPersona} />
        </div>
      ) : null}
      <WarmCard className="motion-continuity-enter motion-stagger-1">
        <p className="text-sm font-semibold">방 요약</p>
        <p className="mt-2 text-sm text-pretty text-ink-soft">{memory.summary}</p>
        {memory.pendingContext.length ? (
          <div className="mt-3 rounded-md border border-terracotta/25 bg-terracotta/10 p-3 text-sm text-terracotta">
            pending context {memory.pendingContext.length}개
          </div>
        ) : null}
      </WarmCard>
      <div className="motion-continuity-enter motion-stagger-2">
        <FileList files={files} roomId={roomId} />
      </div>
      <WarmCard className="motion-continuity-enter motion-stagger-3">
        <p className="mb-3 text-sm font-semibold">공유/반입</p>
        <div className="space-y-3">
          {sharedItems.slice(0, 2).map((item) => <SharedItemCard key={item.id} item={item} />)}
          {imports.slice(0, 2).map((item) => <MeetingImportCard key={item.id} item={item} />)}
          {!sharedItems.length && !imports.length ? <p className="text-sm text-ink-soft">아직 공유/반입 항목이 없습니다.</p> : null}
        </div>
      </WarmCard>
      <div className="motion-continuity-enter motion-stagger-3">
        <DecisionTaskPanel roomId={roomId} decisions={decisions} tasks={tasks} taskTargetRooms={taskTargetRooms} />
      </div>
    </div>
  );
}
