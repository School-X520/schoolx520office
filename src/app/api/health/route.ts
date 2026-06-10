import { NextResponse } from "next/server";

import { shouldUseMockData } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DbStatus = "ok" | "error" | "skipped";

// 외부 uptime 모니터/로드밸런서용 가동 확인 엔드포인트. 인증 불필요.
// 민감 정보를 노출하지 않고 모드와 DB 도달 여부만 보고한다.
export async function GET() {
  let mode: "mock" | "supabase";
  try {
    mode = shouldUseMockData() ? "mock" : "supabase";
  } catch {
    // 프로덕션에서 필수 env 누락 시 shouldUseMockData가 throw한다 — 설정 오류로 보고.
    return NextResponse.json(
      { status: "error", reason: "configuration" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let db: DbStatus = "skipped";
  if (mode === "supabase") {
    db = "error";
    try {
      const client = getSupabaseAdminClient() as unknown as {
        from: (table: string) => {
          select: (columns: string) => { limit: (n: number) => Promise<{ error: unknown }> };
        };
      } | null;
      if (client) {
        const { error } = await client.from("rooms").select("id").limit(1);
        db = error ? "error" : "ok";
      }
    } catch {
      db = "error";
    }
  }

  const healthy = mode === "mock" || db === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", mode, db },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
