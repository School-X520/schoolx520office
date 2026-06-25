"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dialogOverlayClassName } from "@/components/ui/dialog-styles";
import { TextArea, TextInput } from "@/components/ui/form-controls";
import { StatusPill } from "@/components/layout/StatusPill";
import { roomTypeLabel, taskStatusLabel } from "@/lib/status-labels";
import type { Decision, Room, Task } from "@/types/domain";

export function DecisionTaskPanel({
  roomId,
  decisions,
  tasks,
  taskTargetRooms,
}: {
  roomId: string;
  decisions: Decision[];
  tasks: Task[];
  taskTargetRooms: Room[];
}) {
  const canManageDecisions = roomId === "meeting";
  const roomNameById = new Map(taskTargetRooms.map((room) => [room.id, room.name]));

  return (
    <>
      <section className="rounded-lg border border-line bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">결정사항</p>
          {canManageDecisions ? <DecisionDialog mode="create" /> : null}
        </div>
        <ul className="space-y-2">
          {decisions.map((decision) => (
            <li key={decision.id} className="motion-continuity-item rounded-md border border-line bg-white/35 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-balance">{decision.title}</p>
                  {decision.description ? <p className="mt-1 text-pretty text-ink-soft">{decision.description}</p> : null}
                </div>
                {canManageDecisions ? (
                  <div className="flex shrink-0 gap-1">
                    <DecisionDialog mode="edit" decision={decision} />
                    <DeleteDecisionButton decision={decision} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {!decisions.length ? (
          <p className="rounded-md border border-dashed border-line bg-white/25 p-3 text-sm text-pretty text-ink-soft">
            메인 회의방에서 결정사항을 추가하면 모든 방에 표시됩니다.
          </p>
        ) : null}
      </section>
      <section className="rounded-lg border border-line bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">할 일</p>
          <TaskDialog roomId={roomId} taskTargetRooms={taskTargetRooms} />
        </div>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="motion-continuity-item rounded-md border border-line bg-white/35 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-balance">{task.title}</p>
                  {task.description ? <p className="mt-1 text-pretty text-ink-soft">{task.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {taskTargetRoomIds(task).map((targetRoomId) => (
                      <StatusPill key={targetRoomId} tone="neutral">
                        {displayRoomName(roomNameById.get(targetRoomId) ?? targetRoomId)}
                      </StatusPill>
                    ))}
                  </div>
                </div>
                <StatusPill tone={task.status === "done" ? "gold" : "sage"}>{taskStatusLabel(task.status)}</StatusPill>
              </div>
            </li>
          ))}
        </ul>
        {!tasks.length ? (
          <p className="rounded-md border border-dashed border-line bg-white/25 p-3 text-sm text-pretty text-ink-soft">
            할 일을 추가하면 메인 회의방과 선택한 업무방에 표시됩니다.
          </p>
        ) : null}
      </section>
    </>
  );
}

function DecisionDialog({ mode, decision }: { mode: "create" | "edit"; decision?: Decision }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(decision?.title ?? "");
  const [description, setDescription] = useState(decision?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveDecision() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(mode === "create" ? "/api/decisions" : `/api/decisions/${decision?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "결정사항을 저장하지 못했습니다.");
        return;
      }
      setOpen(false);
      if (mode === "create") {
        setTitle("");
        setDescription("");
      }
      router.refresh();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {mode === "create" ? (
          <Button size="sm" variant="secondary">
            <Plus className="size-4" />
            추가
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" aria-label={`${decision?.title ?? "결정사항"} 수정`}>
            <Pencil className="size-4" />
          </Button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClassName} />
        <Dialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-line bg-card p-5 shadow-xl">
          <div className="space-y-1 pr-10">
            <Dialog.Title className="text-lg font-semibold text-balance">
              {mode === "create" ? "결정사항 추가" : "결정사항 수정"}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-pretty text-ink-soft">
              메인 회의방 결정사항은 모든 업무방에 표시됩니다.
            </Dialog.Description>
          </div>
          <label className="block text-sm font-medium">
            제목
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1" />
          </label>
          <label className="block text-sm font-medium">
            설명
            <TextArea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1" />
          </label>
          {error ? <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </Dialog.Close>
            <Button type="button" onClick={saveDecision} disabled={isPending || !title.trim()}>
              {isPending ? "저장 중" : "저장"}
            </Button>
          </div>
          <Dialog.Close asChild>
            <Button aria-label="닫기" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X className="size-4" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteDecisionButton({ decision }: { decision: Decision }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteDecision() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/decisions/${decision.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "결정사항을 삭제하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`${decision.title} 삭제`}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlayClassName} />
        <AlertDialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-card p-5 shadow-lg">
          <AlertDialog.Title className="text-base font-semibold text-balance">결정사항 삭제</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-ink-soft">
            삭제하면 모든 방의 결정사항 목록에서 사라집니다.
          </AlertDialog.Description>
          {error ? <p className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </AlertDialog.Cancel>
            <Button type="button" variant="danger" disabled={isPending} onClick={deleteDecision}>
              {isPending ? "삭제 중" : "삭제"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function TaskDialog({ roomId, taskTargetRooms }: { roomId: string; taskTargetRooms: Room[] }) {
  const router = useRouter();
  const isMeeting = roomId === "meeting";
  const currentRoom = taskTargetRooms.find((room) => room.id === roomId);
  const defaultSelection = isMeeting ? [] : [roomId];
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(defaultSelection);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleRoom(targetRoomId: string) {
    setSelectedRoomIds((current) =>
      current.includes(targetRoomId) ? current.filter((id) => id !== targetRoomId) : [...current, targetRoomId],
    );
    setError(null);
  }

  function saveTask() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          title,
          description,
          targetRoomIds: isMeeting ? selectedRoomIds : undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "할 일을 저장하지 못했습니다.");
        return;
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      setSelectedRoomIds(defaultSelection);
      router.refresh();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="size-4" />
          추가
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClassName} />
        <Dialog.Content className="motion-context-dialog fixed left-1/2 top-1/2 z-50 grid max-h-[min(86dvh,40rem)] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border border-line bg-card p-5 shadow-xl">
          <div className="space-y-1 pr-10">
            <Dialog.Title className="text-lg font-semibold text-balance">할 일 추가</Dialog.Title>
            <Dialog.Description className="text-sm text-pretty text-ink-soft">
              {isMeeting
                ? "선택한 업무방과 메인 회의방에 표시됩니다."
                : `${displayRoomName(currentRoom?.name ?? roomId)}과 메인 회의방에 표시됩니다.`}
            </Dialog.Description>
          </div>
          <label className="block text-sm font-medium">
            제목
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1" />
          </label>
          <label className="block text-sm font-medium">
            설명
            <TextArea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1" />
          </label>
          {isMeeting ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">표시할 업무방</p>
              {taskTargetRooms.map((room) => (
                <label key={room.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-white/45 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                    className="size-4 accent-sage"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{displayRoomName(room.name)}</span>
                    <span className="text-xs text-ink-soft">{roomTypeLabel(room.type)}</span>
                  </span>
                </label>
              ))}
              {!taskTargetRooms.length ? <p className="text-sm text-ink-soft">선택 가능한 업무방이 없습니다.</p> : null}
            </div>
          ) : null}
          {error ? <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-2 text-sm text-terracotta">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                취소
              </Button>
            </Dialog.Close>
            <Button type="button" onClick={saveTask} disabled={isPending || !title.trim() || (isMeeting && !selectedRoomIds.length)}>
              <ListChecks className="size-4" />
              {isPending ? "저장 중" : "저장"}
            </Button>
          </div>
          <Dialog.Close asChild>
            <Button aria-label="닫기" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X className="size-4" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function taskTargetRoomIds(task: Task) {
  return task.assigneeRoomId ? [task.assigneeRoomId] : [];
}

function displayRoomName(value: string) {
  if (value.endsWith("방") || value.endsWith("실") || value.endsWith("연구회")) {
    return value;
  }
  return `${value}방`;
}
