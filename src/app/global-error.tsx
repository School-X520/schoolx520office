"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] 치명적 렌더 오류", error);
  }, [error]);

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-dvh items-center justify-center bg-paper px-6 py-12 text-ink">
        <div className="w-full max-w-md rounded-lg border border-line bg-card p-7 text-center shadow-sm">
          <h1 className="text-xl font-semibold">일시적인 오류가 발생했습니다</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            예기치 못한 문제로 페이지를 표시할 수 없습니다. 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-sage px-5 text-sm font-medium text-white transition-colors hover:bg-sage/90"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
