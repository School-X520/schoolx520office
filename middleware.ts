import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const mockMode =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (mockMode) {
    return NextResponse.next();
  }

  // Supabase SSR auth refresh is implemented in server utilities. This middleware
  // intentionally avoids service-role access and leaves strict checks to pages/APIs.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/office/:path*", "/rooms/:path*", "/admin/:path*"],
};
