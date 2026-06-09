"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextArea, TextInput } from "@/components/ui/form-controls";
import { ProfileAvatar } from "@/components/layout/ProfileAvatar";
import type { UserProfile } from "@/types/domain";

type ProfilePayload = {
  profile?: UserProfile;
  error?: string;
};

export function ProfileSettingsDialog({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewUser = {
    ...user,
    displayName: displayName.trim() || user.displayName,
    avatarUrl: avatarUrl.trim() || null,
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, avatarUrl, bio }),
      });
      const payload = (await response.json().catch(() => ({}))) as ProfilePayload;
      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "프로필을 저장하지 못했습니다.");
      }
      setDisplayName(payload.profile.displayName);
      setAvatarUrl(payload.profile.avatarUrl ?? "");
      setBio(payload.profile.bio ?? "");
      setMessage("저장되었습니다.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      title="내 프로필"
      trigger={
        <Button
          type="button"
          variant="ghost"
          className="max-w-[13rem] border-white/15 text-white hover:bg-white/10"
          aria-label="내 프로필 설정"
        >
          <ProfileAvatar user={user} className="size-7 border border-white/30" />
          <span className="hidden max-w-[8rem] truncate text-sm sm:inline">{user.displayName}</span>
        </Button>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-paper/60 p-3">
          <ProfileAvatar user={previewUser} className="size-12 border border-line text-base" />
          <div className="min-w-0">
            <p className="truncate font-medium">{previewUser.displayName}</p>
            <p className="truncate text-xs text-ink-soft">{user.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-display-name" className="text-sm font-medium">
            이름
          </label>
          <TextInput
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-avatar-url" className="text-sm font-medium">
            사진 URL
          </label>
          <TextInput
            id="profile-avatar-url"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-bio" className="text-sm font-medium">
            소개
          </label>
          <TextArea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={240}
            rows={4}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-h-5 text-sm text-ink-soft" aria-live="polite">
            {error ? <span className="text-terracotta">{error}</span> : message}
          </p>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="size-4" />
            {isSubmitting ? "저장 중" : "저장"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
