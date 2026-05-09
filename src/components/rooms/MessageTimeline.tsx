import { MessageBubble } from "@/components/rooms/MessageBubble";
import type { MeetingImport, RoomMessage, SharedItem } from "@/types/domain";

export function MessageTimeline({
  messages,
  sharedItems,
  imports,
}: {
  messages: RoomMessage[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
}) {
  return (
    <div className="space-y-3">
      {messages.length ? (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} sharedItems={sharedItems} imports={imports} />
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-card p-8 text-center">
          <p className="font-medium">아직 메시지가 없습니다.</p>
          <p className="mt-1 text-sm text-ink-soft">첫 메시지를 남기거나 봇에게 업무를 요청하세요.</p>
        </div>
      )}
    </div>
  );
}
