import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import type { UserProfile } from "@/types/domain";

type AvatarProfile = Pick<UserProfile, "displayName" | "email" | "avatarUrl">;

export function ProfileAvatar({ user, className }: { user: AvatarProfile; className?: string }) {
  const avatarUrl = user.avatarUrl?.trim();
  const style: CSSProperties | undefined = avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sage bg-cover bg-center text-xs font-semibold text-white",
        avatarUrl && "text-transparent",
        className,
      )}
      style={style}
      title={user.displayName}
      aria-hidden="true"
    >
      {initialFor(user)}
    </span>
  );
}

function initialFor(user: AvatarProfile) {
  const source = user.displayName.trim() || user.email.trim();
  return Array.from(source)[0]?.toLocaleUpperCase("ko-KR") ?? "?";
}
