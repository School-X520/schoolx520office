import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 py-12 text-ink">
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-7 text-center shadow-sm">
        <p className="text-sm font-medium text-ink-soft">404</p>
        <h1 className="mt-2 text-xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          요청하신 주소가 변경되었거나 더 이상 존재하지 않습니다. 사무실로 돌아가 다시 시도해 주세요.
        </p>
        <Link
          href="/office"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-sage px-5 text-sm font-medium text-white transition-colors hover:bg-sage/90"
        >
          사무실로 돌아가기
        </Link>
      </div>
    </main>
  );
}
