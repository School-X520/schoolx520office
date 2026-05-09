import { Bot, User, Video } from "lucide-react";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import { StatusPill } from "@/components/layout/StatusPill";
import type { MeetingImport, RoomMessage, SharedItem } from "@/types/domain";

export function MessageBubble({
  message,
  sharedItems,
  imports,
}: {
  message: RoomMessage;
  sharedItems: SharedItem[];
  imports: MeetingImport[];
}) {
  if (message.type === "shared_item") {
    const item = sharedItems.find((shared) => shared.id === message.metadata.sharedItemId);
    if (item) {
      return <SharedItemCard item={item} />;
    }
  }
  if (message.type === "meeting_import") {
    const item = imports.find((imported) => imported.id === message.metadata.meetingImportId);
    if (item) {
      return <MeetingImportCard item={item} />;
    }
  }

  const isAgent = message.type === "agent" || message.type === "guest_agent";
  const isSystem = message.type === "system" || message.type === "video_meeting";
  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${
        isSystem
          ? "border-line bg-paper-deep/65"
          : isAgent
            ? "border-sage/25 bg-sage/10"
            : "border-line bg-card"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {message.type === "video_meeting" ? <Video className="size-4 text-bronze" /> : isAgent ? <Bot className="size-4 text-sage" /> : <User className="size-4 text-ink-soft" />}
        <StatusPill tone={message.type === "guest_agent" ? "terracotta" : isAgent ? "sage" : "neutral"}>
          {message.type}
        </StatusPill>
        <time className="ml-auto text-xs text-ink-soft">{new Date(message.createdAt).toLocaleTimeString("ko-KR")}</time>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-pretty">{message.content}</p>
    </article>
  );
}
