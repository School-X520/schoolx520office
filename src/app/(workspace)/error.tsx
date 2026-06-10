"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace] 렌더 오류", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-12 text-ink">
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold">문제가 발생했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          화면을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button type="button" onClick={() => reset()}>
            다시 시도
          </Button>
          <a
            href="/office"
            className="inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep"
          >
            사무실로 이동
          </a>
        </div>
      </div>
    </main>
  );
}
