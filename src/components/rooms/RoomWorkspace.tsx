import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { ActiveVideoMeetingBanner } from "@/components/video-meetings/ActiveVideoMeetingBanner";
import { EmojiBadge } from "@/components/layout/EmojiBadge";
import { MemberAvatarStack } from "@/components/layout/MemberAvatarStack";
import { StatusPill } from "@/components/layout/StatusPill";
import { Button } from "@/components/ui/button";
import { WarmCard } from "@/components/layout/WarmCard";
import { RoomChat } from "@/components/rooms/RoomChat";
import { RoomRightPanel } from "@/components/rooms/RoomRightPanel";
import { RoomThreadControls } from "@/components/rooms/RoomThreadControls";
import { RoomPresence } from "@/components/realtime/RoomPresence";
import { VideoMeetingPanel } from "@/components/video-meetings/VideoMeetingPanel";
import type { RoomViewModel, UserProfile } from "@/types/domain";

export function RoomWorkspace({ view, user }: { view: RoomViewModel; user: UserProfile }) {
  const isMeeting = view.room.id === "meeting";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
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
        <section className="overflow-hidden rounded-lg border border-line bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-balance">{isMeeting ? "메인 회의방 채팅" : `${view.room.name} 채팅`}</h2>
              <p className="mt-1 truncate text-xs text-ink-soft">{view.activeThread.title}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <RoomThreadControls roomId={view.room.id} threads={view.threads} activeThreadId={view.activeThread.id} />
              <StatusPill tone={isMeeting ? "neutral" : view.agent ? "sage" : "gold"}>
                {isMeeting ? "단체 채팅" : view.agent ? "봇 대화 기본" : "단체 채팅"}
              </StatusPill>
            </div>
          </div>
          <RoomChat
            key={view.activeThread.id}
            roomId={view.room.id}
            threadId={view.activeThread.id}
            currentUserId={user.userId}
            isMeeting={isMeeting}
            residentAgent={view.agent}
            guestAgents={view.guestAgents ?? []}
            initialMessages={view.messages}
            sharedItems={view.sharedItems}
            imports={view.imports}
          />
        </section>
        <WarmCard>
          <p className="text-sm text-pretty text-ink-soft">{view.room.description}</p>
        </WarmCard>
        {isMeeting ? <VideoMeetingPanel activeMeeting={view.activeMeeting} /> : null}
      </section>
      <RoomRightPanel
        roomId={view.room.id}
        agent={view.agent}
        canEditAgentPersona={view.membership?.role === "admin"}
        memory={view.memory}
        files={view.files}
        sharedItems={view.sharedItems}
        imports={view.imports}
        decisions={view.decisions}
        tasks={view.tasks}
        taskTargetRooms={view.taskTargetRooms}
      />
    </div>
  );
}
