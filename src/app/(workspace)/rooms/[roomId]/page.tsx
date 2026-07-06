import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoomWorkspace } from "@/components/rooms/RoomWorkspace";
import { AuthError } from "@/server/auth/errors";
import { requireUser } from "@/server/auth/require-user";
import { redirectToLogin } from "@/server/auth/redirect-to-login";
import { getRoomView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";
import type { UserProfile } from "@/types/domain";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return mockStore.listRooms().map((room) => ({ roomId: room.id }));
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ threadId?: string }>;
}) {
  const { roomId } = await params;
  const { threadId } = await searchParams;
  // 인증/리다이렉트는 스트리밍 경계 밖에서 먼저 확정한다.
  const user = await requireUser().catch((error) => {
    if (error instanceof AuthError) {
      return redirectToLogin(`/rooms/${roomId}`);
    }
    throw error;
  });

  // 셸(<main>)과 스켈레톤은 즉시 flush하고, 방 데이터(RPC 1왕복)는 스트리밍으로 채운다.
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5">
      <Suspense fallback={<RoomWorkspaceSkeleton />}>
        <RoomWorkspaceLoader userId={user.userId} roomId={roomId} threadId={threadId} user={user} />
      </Suspense>
    </main>
  );
}

async function RoomWorkspaceLoader({
  userId,
  roomId,
  threadId,
  user,
}: {
  userId: string;
  roomId: string;
  threadId?: string;
  user: UserProfile;
}) {
  const view = await getRoomView(userId, roomId, { threadId });
  if (!view) {
    notFound();
  }
  return <RoomWorkspace view={view} user={user} />;
}

function RoomWorkspaceSkeleton() {
  return (
    <div
      className="grid min-w-0 animate-pulse grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"
      aria-hidden
    >
      <section className="min-w-0 space-y-4">
        <div className="rounded-lg border border-line bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-paper-deep" />
            <div className="space-y-2">
              <div className="h-6 w-40 rounded bg-paper-deep" />
              <div className="h-4 w-24 rounded bg-paper-deep" />
            </div>
          </div>
        </div>
        <div className="h-[60vh] rounded-lg border border-line bg-card shadow-sm" />
      </section>
      <aside className="hidden space-y-4 xl:block">
        <div className="h-40 rounded-lg border border-line bg-card shadow-sm" />
        <div className="h-40 rounded-lg border border-line bg-card shadow-sm" />
      </aside>
    </div>
  );
}
