import Link from "next/link";
import { ShieldCheck, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/layout/StatusPill";
import type { UserProfile } from "@/types/domain";

export function TopHeader({ user }: { user: UserProfile }) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-sage/20 bg-sage text-white shadow-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/office" className="space-y-0.5">
          <p className="text-lg font-semibold text-balance">School-X 교사연구회 AI Office</p>
          <p className="text-xs text-pretty text-white/78">부서형 작업실 · 메인 회의방 · 호출형 에이전트 브리핑</p>
        </Link>
        <div className="flex items-center gap-2">
          <StatusPill tone="gold">
            <ShieldCheck className="size-3.5" />
            Google 인증 사용자
          </StatusPill>
          {user.isAdmin ? <StatusPill tone="terracotta">승인</StatusPill> : null}
          {user.isAdmin ? (
            <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="관리">
              <Link href="/admin">
                <Settings className="size-4" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="로그아웃">
            <a href="/logout">
              <LogOut className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
