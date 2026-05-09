import { FileList } from "@/components/files/FileList";
import { WarmCard } from "@/components/layout/WarmCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import type { Decision, DomainMemory, FileRecord, MeetingImport, SharedItem, Task } from "@/types/domain";

export function RoomRightPanel({
  roomId,
  memory,
  files,
  sharedItems,
  imports,
  decisions,
  tasks,
}: {
  roomId: string;
  memory: DomainMemory;
  files: FileRecord[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  decisions: Decision[];
  tasks: Task[];
}) {
  return (
    <div className="space-y-4">
      <WarmCard>
        <p className="text-sm font-semibold">방 요약</p>
        <p className="mt-2 text-sm text-pretty text-ink-soft">{memory.summary}</p>
        {memory.pendingContext.length ? (
          <div className="mt-3 rounded-md border border-terracotta/25 bg-terracotta/10 p-3 text-sm text-terracotta">
            pending context {memory.pendingContext.length}개
          </div>
        ) : null}
      </WarmCard>
      <FileList files={files} roomId={roomId} />
      <WarmCard>
        <p className="mb-3 text-sm font-semibold">공유/반입</p>
        <div className="space-y-3">
          {sharedItems.slice(0, 2).map((item) => <SharedItemCard key={item.id} item={item} />)}
          {imports.slice(0, 2).map((item) => <MeetingImportCard key={item.id} item={item} />)}
          {!sharedItems.length && !imports.length ? <p className="text-sm text-ink-soft">아직 공유/반입 항목이 없습니다.</p> : null}
        </div>
      </WarmCard>
      <WarmCard>
        <p className="mb-3 text-sm font-semibold">결정사항</p>
        <ul className="space-y-2">
          {decisions.map((decision) => (
            <li key={decision.id} className="rounded-md border border-line bg-white/35 p-2 text-sm">{decision.title}</li>
          ))}
        </ul>
      </WarmCard>
      <WarmCard>
        <p className="mb-3 text-sm font-semibold">할 일</p>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-md border border-line bg-white/35 p-2 text-sm">
              <span className="font-medium">{task.title}</span>
              <span className="ml-2 text-xs text-ink-soft">{task.status}</span>
            </li>
          ))}
        </ul>
      </WarmCard>
    </div>
  );
}
