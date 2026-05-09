import { notFound, redirect } from "next/navigation";
import { RoomWorkspace } from "@/components/rooms/RoomWorkspace";
import { AuthError } from "@/server/auth/errors";
import { requireUser } from "@/server/auth/require-user";
import { getRoomView } from "@/server/rooms/get-room-view";
import { mockStore } from "@/server/data/mock-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return mockStore.listRooms().map((room) => ({ roomId: room.id }));
}

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const user = await requireUser().catch((error) => {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  });
  const view = await getRoomView(user.userId, roomId);
  if (!view) {
    notFound();
  }
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5">
      <RoomWorkspace view={view} user={user} />
    </main>
  );
}
