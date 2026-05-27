import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { canWriteRoom } from "@/server/auth/require-room-member";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

export async function GET() {
  try {
    const user = await requireUser();
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const [rooms, memberships] = await Promise.all([
      source.listRooms(),
      shouldUseMockData()
        ? Promise.resolve(mockStore.listMemberships().filter((item) => item.userId === user.userId))
        : supabaseStore.listMemberships(user.userId),
    ]);
    const roleByRoomId = new Map(memberships.map((membership) => [membership.roomId, membership.role]));
    const targets = rooms
      .filter((room) => room.id !== "meeting" && canWriteRoom(roleByRoomId.get(room.id)))
      .map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        role: roleByRoomId.get(room.id),
      }));
    return jsonOk({ rooms: targets });
  } catch (error) {
    return jsonError(error);
  }
}
