import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/server/auth/require-user";
import { requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";

export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
  return jsonOk({ tasks: mockStore.listTasks(roomId) });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      roomId?: string;
      title?: string;
      description?: string;
      assigneeRoomId?: string;
    };
    const roomId = body.roomId ?? "meeting";
    await requireRoomMember(user.userId, roomId);
    const task = mockStore.createTask({
      roomId,
      title: body.title ?? "새 할 일",
      description: body.description ?? null,
      assigneeRoomId: body.assigneeRoomId ?? null,
      createdBy: user.userId,
    });
    mockStore.addAuditLog({
      actorUserId: user.userId,
      roomId,
      action: "task.created",
      targetType: "task",
      targetId: task.id,
    });
    return jsonOk({ task });
  } catch (error) {
    return jsonError(error);
  }
}
