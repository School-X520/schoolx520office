import { Shield, UserPlus, Users } from "lucide-react";
import { AllowedUserForm } from "@/components/admin/AllowedUserForm";
import { MembershipManager } from "@/components/admin/MembershipManager";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import type { AllowedUser, RoomMembership, Room, UserProfile } from "@/types/domain";

export function AdminDashboard({
  allowedUsers,
  memberships,
  profiles,
  rooms,
}: {
  allowedUsers: AllowedUser[];
  memberships: RoomMembership[];
  profiles: UserProfile[];
  rooms: Room[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-balance">관리자 페이지</h1>
        <p className="text-sm text-pretty text-ink-soft">승인 사용자, 방 권한, 운영 로그를 관리합니다.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WarmCard>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="size-4 text-sage" />
              승인 사용자
            </p>
            <StatusPill tone="gold">{allowedUsers.length}</StatusPill>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink-soft">
                <tr>
                  <th className="py-2">email</th>
                  <th className="py-2">active</th>
                  <th className="py-2">admin</th>
                </tr>
              </thead>
              <tbody>
                {allowedUsers.map((user) => (
                  <tr key={user.email} className="border-t border-line">
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">{String(user.isActive)}</td>
                    <td className="py-2">{String(Boolean(user.isAdmin))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WarmCard>
        <WarmCard>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4 text-terracotta" />
            새 사용자 초대
          </p>
          <AllowedUserForm />
        </WarmCard>
      </div>
      <WarmCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-sage" />
            방 권한
          </p>
          <StatusPill tone="neutral">{profiles.length} profiles</StatusPill>
        </div>
        <MembershipManager rooms={rooms} memberships={memberships} profiles={profiles} />
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const count = memberships.filter((item) => item.roomId === room.id).length;
            return (
              <div key={room.id} className="rounded-md border border-line bg-white/35 p-3">
                <p className="font-medium">{room.icon} {room.name}</p>
                <p className="text-sm text-ink-soft tabular-nums">{count}명</p>
              </div>
            );
          })}
        </div>
      </WarmCard>
    </div>
  );
}
