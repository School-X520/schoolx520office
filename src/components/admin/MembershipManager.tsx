"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Room, RoomMembership, RoomRole, UserProfile } from "@/types/domain";

const selectClass =
  "h-10 w-full rounded-md border border-line bg-white/70 px-3 text-sm text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2";

export function MembershipManager({
  rooms,
  memberships,
  profiles,
}: {
  rooms: Room[];
  memberships: RoomMembership[];
  profiles: UserProfile[];
}) {
  const router = useRouter();
  const firstUserId = profiles[0]?.userId ?? "";
  const firstRoomId = rooms[0]?.id ?? "meeting";
  function membershipRole(userId: string, nextRoomId: string) {
    return memberships.find((item) => item.userId === userId && item.roomId === nextRoomId)?.role ?? "member";
  }

  const [targetUserId, setTargetUserId] = useState(firstUserId);
  const [roomId, setRoomId] = useState(firstRoomId);
  const [role, setRole] = useState<RoomRole>(() => membershipRole(firstUserId, firstRoomId));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedMembership = useMemo(
    () => memberships.find((item) => item.userId === targetUserId && item.roomId === roomId),
    [memberships, roomId, targetUserId],
  );

  async function submit(action: "membership.updated" | "membership.removed") {
    if (!targetUserId || !roomId) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/memberships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, targetUserId, roomId, role }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? result.message ?? "권한 변경에 실패했습니다.");
        return;
      }
      setMessage(action === "membership.removed" ? "방 권한을 제거했습니다." : "방 권한을 저장했습니다.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_10rem]">
      <select
        className={selectClass}
        value={targetUserId}
        aria-label="사용자 선택"
        onChange={(event) => {
          const nextUserId = event.target.value;
          setTargetUserId(nextUserId);
          setRole(membershipRole(nextUserId, roomId));
        }}
      >
        {profiles.map((profile) => (
          <option key={profile.userId} value={profile.userId}>
            {profile.email}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={roomId}
        aria-label="방 선택"
        onChange={(event) => {
          const nextRoomId = event.target.value;
          setRoomId(nextRoomId);
          setRole(membershipRole(targetUserId, nextRoomId));
        }}
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
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
      <div className="flex flex-wrap gap-2 lg:col-span-3">
        <Button type="button" size="sm" disabled={isPending || !profiles.length} onClick={() => submit("membership.updated")}>
          <ShieldCheck className="size-4" />
          권한 저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending || !selectedMembership}
          onClick={() => submit("membership.removed")}
        >
          <UserMinus className="size-4" />
          권한 제거
        </Button>
        {selectedMembership ? (
          <span className="self-center text-sm text-ink-soft">현재 권한: {selectedMembership.role}</span>
        ) : (
          <span className="self-center text-sm text-ink-soft">현재 권한 없음</span>
        )}
      </div>
      {message ? <p className="text-sm text-ink-soft lg:col-span-3">{message}</p> : null}
    </div>
  );
}
