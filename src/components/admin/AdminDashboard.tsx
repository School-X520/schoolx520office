import { Shield, UserPlus, Users } from "lucide-react";
import { AllowedUserForm } from "@/components/admin/AllowedUserForm";
import { AllowedUsersManager } from "@/components/admin/AllowedUsersManager";
import { MembershipManager } from "@/components/admin/MembershipManager";
import { WarmCard } from "@/components/layout/WarmCard";
import { StatusPill } from "@/components/layout/StatusPill";
import type { AllowedUser, RoomMembership, Room, UserProfile } from "@/types/domain";

export function AdminDashboard({
  allowedUsers,
  currentUserEmail,
  memberships,
  profiles,
  rooms,
}: {
  allowedUsers: AllowedUser[];
  currentUserEmail: string;
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
          <AllowedUsersManager allowedUsers={allowedUsers} currentUserEmail={currentUserEmail} />
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
      </WarmCard>
    </div>
  );
}
