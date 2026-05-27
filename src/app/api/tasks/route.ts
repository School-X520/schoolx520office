import { jsonError, jsonOk } from "@/lib/api";
import { shouldUseMockData } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import type { Task } from "@/types/domain";

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function taskVisibleInRooms(task: Task, roomIds: Set<string>) {
  return roomIds.has(task.roomId) || (task.assigneeRoomId ? roomIds.has(task.assigneeRoomId) : false);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? undefined;
    if (roomId) {
      await requireRoomMember(user.userId, roomId);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    if (roomId) {
      return jsonOk({ tasks: await source.listTasks(roomId) });
    }
    const memberships = shouldUseMockData()
      ? mockStore.listMemberships().filter((membership) => membership.userId === user.userId)
      : await supabaseStore.listMemberships(user.userId);
    const roomIds = new Set(memberships.map((membership) => membership.roomId));
    return jsonOk({ tasks: (await source.listTasks()).filter((task) => taskVisibleInRooms(task, roomIds)) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      roomId?: string;
      title?: string;
      description?: string;
      assigneeRoomId?: string;
      targetRoomIds?: string[];
    };
    const currentRoomId = body.roomId ?? "meeting";
    const currentMembership = await requireRoomMember(user.userId, currentRoomId);
    if (!canWriteRoom(currentMembership.role)) {
      throw statusError("할 일을 추가할 권한이 없습니다.", 403);
    }
    await requireRoomMember(user.userId, "meeting");
    const title = body.title?.trim();
    if (!title) {
      throw statusError("할 일 제목이 필요합니다.", 400);
    }
    const source = shouldUseMockData() ? mockStore : supabaseStore;
    const targetRoomIds =
      currentRoomId === "meeting" && Array.isArray(body.targetRoomIds) && body.targetRoomIds.length
        ? body.targetRoomIds
        : [currentRoomId === "meeting" ? body.assigneeRoomId ?? "" : currentRoomId];
    const uniqueTargetRoomIds = [...new Set(targetRoomIds.map((roomId) => roomId.trim()).filter(Boolean))];
    if (!uniqueTargetRoomIds.length) {
      throw statusError("할 일을 표시할 방을 하나 이상 선택해 주세요.", 400);
    }

    const writableTargetRoomIds: string[] = [];
    for (const targetRoomId of uniqueTargetRoomIds) {
      if (targetRoomId === "meeting") {
        throw statusError("업무방을 선택해 주세요.", 400);
      }
      const membership = await requireRoomMember(user.userId, targetRoomId);
      if (!canWriteRoom(membership.role)) {
        throw statusError("선택한 방에 할 일을 추가할 권한이 없습니다.", 403);
      }
      writableTargetRoomIds.push(targetRoomId);
    }

    const tasks = await Promise.all(
      writableTargetRoomIds.map((targetRoomId) =>
        source.createTask({
          roomId: "meeting",
          title,
          description: body.description?.trim() || null,
          assigneeRoomId: targetRoomId,
          createdBy: user.userId,
        }),
      ),
    );
    await Promise.all(
      tasks.map((task) =>
        source.addAuditLog({
          actorUserId: user.userId,
          roomId: "meeting",
          action: "task.created",
          targetType: "task",
          targetId: task.id,
          metadata: { sourceRoomId: currentRoomId, visibleInRoomIds: ["meeting", task.assigneeRoomId] },
        }),
      ),
    );
    return jsonOk({ task: tasks[0], tasks });
  } catch (error) {
    return jsonError(error);
  }
}
