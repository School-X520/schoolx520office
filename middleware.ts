import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 보호 경로에서 Supabase 세션 토큰을 갱신해 쿠키에 다시 굽는다(@supabase/ssr 공식 패턴).
// 빈 미들웨어였을 때는 access token이 만료되면 서버 컴포넌트가 토큰을 갱신할 수 없어
// (server.ts의 setAll이 삼켜짐) 장기 세션에서 비결정적 로그아웃이 발생할 수 있었다.
// 인증 게이트(미인증 → /login)는 페이지/라우트 레벨에서 이미 처리하므로 여기서는 추가하지 않는다.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // mock 모드 또는 Supabase 미설정 시에는 갱신할 세션이 없다.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  try {
    // createServerClient와 getUser 사이에 다른 로직을 넣지 말 것 — 토큰 갱신 쿠키 동기화가 깨질 수 있다.
    await supabase.auth.getUser();
  } catch {
    // Supabase 도달 실패 등은 막지 않고 통과시킨다(페이지 레벨 가드가 최종 처리).
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/office/:path*", "/rooms/:path*", "/admin/:path*"],
};
