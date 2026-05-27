"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils/cn";
import type { AllowedUser } from "@/types/domain";

type Field = "isActive" | "isAdmin";

export function AllowedUsersManager({
  allowedUsers,
  currentUserEmail,
}: {
  allowedUsers: AllowedUser[];
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateAllowedUser(user: AllowedUser, field: Field, value: boolean) {
    const normalizedCurrentEmail = currentUserEmail.toLowerCase();
    if (user.email.toLowerCase() === normalizedCurrentEmail && value === false) {
      setMessage("현재 로그인한 관리자의 active/admin 권한은 직접 끌 수 없습니다.");
      return;
    }
    setMessage(null);
    setPendingKey(`${user.email}:${field}`);
    startTransition(async () => {
      const response = await fetch("/api/admin/allowed-users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, [field]: value }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setMessage(result.error ?? result.message ?? "사용자 상태 변경에 실패했습니다.");
        setPendingKey(null);
        return;
      }
      setMessage(field === "isActive" ? "active 상태를 변경했습니다." : "admin 권한을 변경했습니다.");
      setPendingKey(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden">
        <div className="w-full text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_5.75rem_5.75rem] gap-2 border-b border-line pb-2 text-xs font-semibold text-ink-soft">
            <span>email</span>
            <span>계정 상태</span>
            <span>어드민</span>
          </div>
          <div className="divide-y divide-line">
            {allowedUsers.map((user) => (
              <div
                key={user.email}
                className="grid grid-cols-[minmax(0,1fr)_5.75rem_5.75rem] items-center gap-2 py-3"
              >
                <span className="min-w-0 truncate pr-1 text-sm text-ink">{user.email}</span>
                <StateSwitch
                  checked={user.isActive}
                  disabled={isPending}
                  pending={pendingKey === `${user.email}:isActive`}
                  label={`${user.email} active`}
                  onText="활성"
                  offText="차단"
                  onChange={(checked) => updateAllowedUser(user, "isActive", checked)}
                />
                <StateSwitch
                  checked={Boolean(user.isAdmin)}
                  disabled={isPending}
                  pending={pendingKey === `${user.email}:isAdmin`}
                  label={`${user.email} admin`}
                  onText="어드민"
                  offText="일반"
                  onChange={(checked) => updateAllowedUser(user, "isAdmin", checked)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

function StateSwitch({
  checked,
  disabled,
  pending,
  label,
  onText,
  offText,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  pending: boolean;
  label: string;
  onText: string;
  offText: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "border-sage bg-sage" : "border-line bg-white/80",
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            "absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition",
            checked ? "left-5" : "left-1",
          )}
        />
      </button>
      <span className={cn("w-9 text-xs font-medium", checked ? "text-sage" : "text-ink-soft")}>
        {pending ? "저장 중" : checked ? onText : offText}
      </span>
    </div>
  );
}
