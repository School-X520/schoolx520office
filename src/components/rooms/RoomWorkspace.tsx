import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { ActiveVideoMeetingBanner } from "@/components/video-meetings/ActiveVideoMeetingBanner";
import { EmojiBadge } from "@/components/layout/EmojiBadge";
import { MemberAvatarStack } from "@/components/layout/MemberAvatarStack";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { WarmCard } from "@/components/layout/WarmCard";
import { MessageTimeline } from "@/components/rooms/MessageTimeline";
import { MessageComposer } from "@/components/rooms/MessageComposer";
import { RoomRightPanel } from "@/components/rooms/RoomRightPanel";
import { RoomPresence } from "@/components/realtime/RoomPresence";
import { VideoMeetingPanel } from "@/components/video-meetings/VideoMeetingPanel";
import type { RoomViewModel, UserProfile } from "@/types/domain";

export function RoomWorkspace({ view, user }: { view: RoomViewModel; user: UserProfile }) {
  const isMeeting = view.room.id === "meeting";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-lg border border-line bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild variant="ghost" size="icon" aria-label="사무실로">
                <Link href="/office">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <EmojiBadge icon={view.room.icon} label={view.room.name} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">{view.room.name}</h1>
                <div className="mt-1 flex flex-wrap gap-2">
                  <StatusPill tone="neutral">{view.room.type}</StatusPill>
                  <StatusPill tone={view.agent ? "sage" : "gold"}>
                    <Bot className="size-3" />
                    {view.agent ? `${view.agent.name} 대기` : "상주 봇 없음"}
                  </StatusPill>
                  <RoomPresence roomId={view.room.id} />
                </div>
              </div>
            </div>
            <MemberAvatarStack users={[user]} />
          </div>
        </div>
        {isMeeting ? <ActiveVideoMeetingBanner meeting={view.activeMeeting} /> : null}
        <WarmCard>
          <p className="text-sm text-pretty text-ink-soft">{view.room.description}</p>
        </WarmCard>
        {isMeeting ? <VideoMeetingPanel activeMeeting={view.activeMeeting} /> : null}
        <MessageTimeline messages={view.messages} sharedItems={view.sharedItems} imports={view.imports} />
        <MessageComposer roomId={view.room.id} hasResidentBot={Boolean(view.agent)} isMeeting={isMeeting} />
      </section>
      <RoomRightPanel
        roomId={view.room.id}
        memory={view.memory}
        files={view.files}
        sharedItems={view.sharedItems}
        imports={view.imports}
        decisions={view.decisions}
        tasks={view.tasks}
      />
    </div>
  );
}
