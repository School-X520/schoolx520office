"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/form-controls";

export function AllowedUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const response = await fetch("/api/admin/allowed-users", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, notes, isAdmin, isActive: true }),
          });
          const result = (await response.json()) as { error?: string; message?: string };
          if (!response.ok) {
            setMessage(result.error ?? result.message ?? "저장에 실패했습니다.");
            return;
          }
          setEmail("");
          setNotes("");
          setIsAdmin(false);
          setMessage("승인 사용자에 추가했습니다.");
          router.refresh();
        });
      }}
    >
      <TextInput
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="teacher@example.com"
        aria-label="승인 사용자 이메일"
      />
      <TextArea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="메모"
        aria-label="승인 사용자 메모"
        className="min-h-20"
      />
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(event) => setIsAdmin(event.target.checked)}
          className="size-4 rounded border-line"
        />
        관리자 권한
      </label>
      <Button type="submit" className="w-full" disabled={isPending || !email.trim()}>
        <UserPlus className="size-4" />
        승인 사용자 추가
      </Button>
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </form>
  );
}
