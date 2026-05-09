import type { UserProfile } from "@/types/domain";

export function MemberAvatarStack({ users }: { users: UserProfile[] }) {
  return (
    <div className="flex -space-x-2">
      {users.slice(0, 4).map((user) => (
        <span
          key={user.userId}
          className="inline-flex size-8 items-center justify-center rounded-full border-2 border-card bg-sage text-xs font-semibold text-white"
          title={user.displayName}
        >
          {user.displayName.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}
