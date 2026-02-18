import { NextRequest, NextResponse } from "next/server"

const protectedPaths = ["/change-password", "/owner", "/team", "/sales", "/leads", "/pipeline", "/analytics", "/meetings", "/settings", "/connect"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("auth_token")?.value
  const role = request.cookies.get("auth_role")?.value
  const forceReset = request.cookies.get("auth_force_reset")?.value === "true"

  // Handle root path redirect
  if (pathname === "/") {
    if (token && role) {
      const destination = role === "owner" ? "/owner" : role === "team_leader" ? "/team" : "/sales"
      return NextResponse.redirect(new URL(destination, request.url))
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (!protectedPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (!token || !role) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (forceReset && !pathname.startsWith("/change-password")) {
    return NextResponse.redirect(new URL("/change-password", request.url))
  }
  if (!forceReset && pathname.startsWith("/change-password")) {
    const destination = role === "owner" ? "/owner" : role === "team_leader" ? "/team" : "/sales"
    return NextResponse.redirect(new URL(destination, request.url))
  }
  if (pathname.startsWith("/change-password")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/owner") && role !== "owner") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  if (pathname.startsWith("/team") && !["owner", "team_leader"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  if (pathname.startsWith("/sales") && !["owner", "team_leader", "sales"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  if (pathname.startsWith("/analytics") && !["owner", "team_leader"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  if (pathname.startsWith("/settings") && !["owner", "team_leader"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  if (pathname.startsWith("/connect") && !["owner", "team_leader", "sales"].includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/change-password", "/owner/:path*", "/team/:path*", "/sales/:path*", "/leads/:path*", "/pipeline/:path*", "/analytics/:path*", "/meetings/:path*", "/settings/:path*", "/connect/:path*"]
}
