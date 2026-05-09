import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/office/:path*", "/rooms/:path*", "/admin/:path*"],
};
