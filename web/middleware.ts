import { NextRequest, NextResponse } from "next/server"

const protectedPaths = ["/change-password", "/owner", "/team", "/sales", "/leads", "/pipeline", "/analytics", "/meetings", "/settings", "/connect"]

export function middleware(request: NextRequest) {
  // Allow everything for now to debug deployment
  return NextResponse.next()
}

export const config = {
  matcher: ["/change-password", "/owner/:path*", "/team/:path*", "/sales/:path*", "/leads/:path*", "/pipeline/:path*", "/analytics/:path*", "/meetings/:path*", "/settings/:path*", "/connect/:path*"]
}
