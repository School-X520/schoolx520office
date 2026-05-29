"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { AllowedUser, PendingRoomMembership, Room, RoomMembership, RoomRole, UserProfile } from "@/types/domain";

const selectClass =
  "h-10 w-full rounded-md border border-line bg-white/70 px-3 text-sm text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

export function MembershipManager({
  allowedUsers,
  rooms,
  memberships,
  pendingMemberships,
  profiles,
}: {
  allowedUsers: AllowedUser[];
  rooms: Room[];
  memberships: RoomMembership[];
  pendingMemberships: PendingRoomMembership[];
  profiles: UserProfile[];
}) {
  const router = useRouter();
  const targets = useMemo(
    () => buildMembershipTargets(profiles, allowedUsers),
    [allowedUsers, profiles],
  );
  const firstTargetId = targets[0]?.id ?? "";

  function membershipRole(targetId: string, nextRoomId: string) {
    const target = targets.find((item) => item.id === targetId);
    if (!target) {
      return "member";
    }
    if (target.userId) {
      return memberships.find((item) => item.userId === target.userId && item.roomId === nextRoomId)?.role ?? "member";
    }
    return pendingMemberships.find((item) => item.email === target.email && item.roomId === nextRoomId)?.role ?? "member";
  }

  function hasMembership(targetId: string, nextRoomId: string) {
    const target = targets.find((item) => item.id === targetId);
    if (!target) {
      return false;
    }
    if (target.userId) {
      return memberships.some((item) => item.userId === target.userId && item.roomId === nextRoomId);
    }
    return pendingMemberships.some((item) => item.email === target.email && item.roomId === nextRoomId);
  }

  const [targetUserId, setTargetUserId] = useState(firstTargetId);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() => (rooms[0]?.id ? [rooms[0].id] : []));
  const [role, setRole] = useState<RoomRole>("member");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedExistingCount = selectedRoomIds.filter((roomId) => hasMembership(targetUserId, roomId)).length;

  function toggleRoom(roomId: string) {
    setSelectedRoomIds((current) =>
      current.includes(roomId) ? current.filter((item) => item !== roomId) : [...current, roomId],
    );
  }

  async function submit(action: "membership.updated" | "membership.removed") {
    if (!targetUserId || !selectedRoomIds.length) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/memberships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, targetUserId, roomIds: selectedRoomIds, role }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? result.message ?? "권한 변경에 실패했습니다.");
        return;
      }
      const count = selectedRoomIds.length;
      setMessage(
        action === "membership.removed" ? `${count}개 방 권한을 제거했습니다.` : `${count}개 방 권한을 저장했습니다.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_10rem]">
        <select
          className={selectClass}
          value={targetUserId}
          aria-label="사용자 선택"
          onChange={(event) => {
            const nextUserId = event.target.value;
            setTargetUserId(nextUserId);
          }}
        >
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.email}
              {target.pending ? " (가입 전)" : ""}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={role}
          aria-label="권한 선택"
          onChange={(event) => setRole(event.target.value as RoomRole)}
        >
          <option value="member">member</option>
          <option value="observer">observer</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !rooms.length}
          onClick={() => setSelectedRoomIds(rooms.map((room) => room.id))}
        >
          전체 선택
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !selectedRoomIds.length}
          onClick={() => setSelectedRoomIds([])}
        >
          선택 해제
        </Button>
        <span className="text-sm text-ink-soft">
          선택 {selectedRoomIds.length}개 · 기존 권한 {selectedExistingCount}개
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => {
          const selected = selectedRoomIds.includes(room.id);
          const currentRole = membershipRole(targetUserId, room.id);
          const currentHasMembership = hasMembership(targetUserId, room.id);
          const count =
            memberships.filter((item) => item.roomId === room.id).length +
            pendingMemberships.filter((item) => item.roomId === room.id).length;
          return (
            <label
              key={room.id}
              className={cn(
                "flex min-h-24 cursor-pointer gap-3 rounded-md border bg-white/35 p-3 transition hover:bg-card",
                selected ? "border-sage bg-sage/10 shadow-sm" : "border-line",
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleRoom(room.id)}
                className="mt-1 size-4 rounded border-line accent-sage"
                aria-label={`${room.name} 선택`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-medium">
                  <span>{room.icon}</span>
                  <span className="truncate">{room.name}</span>
                  {selected ? <Check className="ml-auto size-4 text-sage" /> : null}
                </span>
                <span className="mt-1 block text-sm text-ink-soft tabular-nums">{count}명</span>
                <span className="mt-1 block text-xs text-ink-soft">
                  {currentHasMembership ? `현재 권한: ${currentRole}` : "현재 권한 없음"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !targets.length || !selectedRoomIds.length}
          onClick={() => submit("membership.updated")}
        >
          <ShieldCheck className="size-4" />
          권한 저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !targets.length || !selectedRoomIds.length}
          onClick={() => submit("membership.removed")}
        >
          <UserMinus className="size-4" />
          권한 제거
        </Button>
      </div>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

type MembershipTarget = {
  id: string;
  email: string;
  userId?: string;
  pending: boolean;
};

function buildMembershipTargets(profiles: UserProfile[], allowedUsers: AllowedUser[]): MembershipTarget[] {
  const profileTargets = profiles.map((profile) => ({
    id: profile.userId,
    email: profile.email.toLowerCase(),
    userId: profile.userId,
    pending: false,
  }));
  const profileEmails = new Set(profileTargets.map((target) => target.email));
  const pendingTargets = allowedUsers
    .filter((user) => user.isActive && !profileEmails.has(user.email.toLowerCase()))
    .map((user) => ({
      id: `email:${user.email.toLowerCase()}`,
      email: user.email.toLowerCase(),
      pending: true,
    }));
  return [...profileTargets, ...pendingTargets].sort((a, b) => a.email.localeCompare(b.email));
}
