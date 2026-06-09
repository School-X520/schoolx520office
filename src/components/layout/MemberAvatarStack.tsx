import { ProfileAvatar } from "@/components/layout/ProfileAvatar";
import type { UserProfile } from "@/types/domain";

export function MemberAvatarStack({ users }: { users: UserProfile[] }) {
  return (
    <div className="flex -space-x-2">
      {users.slice(0, 4).map((user) => (
        <ProfileAvatar
          key={user.userId}
          user={user}
          className="border-2 border-card"
        />
      ))}
    </div>
  );
}
