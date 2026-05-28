import { Bot, FileText, User, Video } from "lucide-react";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import { FileDownloadButton } from "@/components/files/FileDownloadButton";
import { MessageCopyButton } from "@/components/rooms/MessageCopyButton";
import { cn } from "@/lib/utils/cn";
import type { Agent, MeetingImport, RoomMessage, SharedItem } from "@/types/domain";

export function MessageBubble({
  message,
  sharedItems,
  imports,
  currentUserId,
  agents,
}: {
  message: RoomMessage;
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  currentUserId: string;
  agents: Agent[];
}) {
  if (message.type === "shared_item") {
    const item = sharedItems.find((shared) => shared.id === message.metadata.sharedItemId);
    if (item) {
      return (
        <div className="motion-continuity-item mx-auto w-full max-w-2xl">
          <div className="mb-1 flex justify-end">
            <MessageCopyButton text={message.content} />
          </div>
          <SharedItemCard item={item} />
        </div>
      );
    }
  }
  if (message.type === "meeting_import") {
    const item = imports.find((imported) => imported.id === message.metadata.meetingImportId);
    if (item) {
      return (
        <div className="motion-continuity-item mx-auto w-full max-w-2xl">
          <div className="mb-1 flex justify-end">
            <MessageCopyButton text={message.content} />
          </div>
          <MeetingImportCard item={item} />
        </div>
      );
    }
  }

  const isAgent = message.type === "agent" || message.type === "guest_agent";
  const isSystem = message.type === "system" || message.type === "video_meeting";
  const isOwn = message.type === "human" && message.senderUserId === currentUserId;
  const agentName = message.senderAgentId
    ? agents.find((agent) => agent.id === message.senderAgentId)?.name
    : null;
  const guestLabel = typeof message.metadata.guestLabel === "string" ? message.metadata.guestLabel : null;
  const generatedFiles = getGeneratedFiles(message.metadata);
  const speakerName = isAgent ? (guestLabel ?? agentName ?? "업무 봇") : isOwn ? "나" : "구성원";
  const time = new Date(message.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSystem) {
    return (
      <div className="motion-continuity-item flex justify-center">
        <div className="max-w-2xl rounded-lg border border-line bg-paper-deep/70 px-3 py-2 text-center text-sm text-ink-soft shadow-sm">
          <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium">
            {message.type === "video_meeting" ? <Video className="size-3.5 text-bronze" /> : null}
            <time className="tabular-nums">{time}</time>
            <MessageCopyButton text={message.content} className="size-6 border-line/80 bg-card/80" />
          </div>
          <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <article className={cn("motion-continuity-item flex w-full gap-2", isOwn ? "justify-end" : "justify-start")}>
      {!isOwn ? (
        <div
          className={cn(
            "mt-5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
            isAgent ? "border-sage/25 bg-sage/10 text-sage" : "border-line bg-card text-ink-soft",
          )}
          aria-hidden="true"
        >
          {isAgent ? <Bot className="size-4" /> : <User className="size-4" />}
        </div>
      ) : null}
      <div className={cn("flex max-w-[min(78%,42rem)] flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn ? (
          <div className="mb-1 flex items-center gap-2 px-1 text-xs text-ink-soft">
            <span className="font-medium text-ink">{speakerName}</span>
            <time className="tabular-nums">{time}</time>
            <MessageCopyButton text={message.content} className="size-6" />
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-6 shadow-sm",
            isOwn
              ? "bg-sage text-white"
              : isAgent
                ? "border border-sage/25 bg-sage/10 text-ink"
                : "border border-line bg-card text-ink",
          )}
        >
          <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
          {generatedFiles.length ? (
            <div className="mt-3 space-y-2 border-t border-line/70 pt-3">
              {generatedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-2 rounded-md border border-line bg-white/55 px-2 py-1.5">
                  <FileText className="size-4 shrink-0 text-bronze" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{file.originalName}</p>
                    <p className="text-[11px] text-ink-soft tabular-nums">{Math.max(1, Math.round(file.sizeBytes / 1024))}KB</p>
                  </div>
                  <FileDownloadButton fileId={file.id} roomId={message.roomId} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {isOwn ? (
          <div className="mt-1 flex items-center gap-1 px-1 text-xs text-ink-soft">
            <time className="tabular-nums">{time}</time>
            <MessageCopyButton text={message.content} className="size-6" />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function getGeneratedFiles(metadata: RoomMessage["metadata"]) {
  const value = metadata.generatedFiles;
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((file) => {
    if (!file || typeof file !== "object") {
      return [];
    }
    const record = file as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.originalName !== "string") {
      return [];
    }
    return [
      {
        id: record.id,
        originalName: record.originalName,
        sizeBytes: typeof record.sizeBytes === "number" ? record.sizeBytes : 0,
      },
    ];
  });
}
