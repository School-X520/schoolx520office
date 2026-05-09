import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarmCard } from "@/components/layout/WarmCard";
import { getCurrentUser } from "@/server/auth/get-current-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentUser()]);

  if (currentUser) {
    redirect("/office");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <WarmCard className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-xl bg-gold-soft text-3xl">
            🏛️
          </span>
          <h1 className="text-2xl font-semibold text-balance">교과연구회 AI Office</h1>
          <p className="mt-2 text-sm text-pretty text-ink-soft">관리자에게 승인된 Google 계정만 접근할 수 있습니다.</p>
        </div>
        {params.error === "not-approved" ? (
          <div className="mb-4 rounded-md border border-terracotta/35 bg-terracotta/10 p-3 text-sm text-terracotta">
            관리자 승인이 필요합니다.
          </div>
        ) : null}
        {params.error === "oauth" ? (
          <div className="mb-4 rounded-md border border-terracotta/35 bg-terracotta/10 p-3 text-sm text-terracotta">
            Google 로그인 연결을 완료하지 못했습니다.
          </div>
        ) : null}
        <Button asChild className="w-full">
          <Link href="/auth/login">
            <Globe2 className="size-4" />
            Google로 로그인
          </Link>
        </Button>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-soft">
          <ShieldCheck className="size-3.5" />
          Mock mode에서는 바로 입장합니다.
        </div>
      </WarmCard>
    </main>
  );
}
