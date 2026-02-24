import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Log the requested path for debugging
  console.log(`[Middleware] Request: ${request.nextUrl.pathname}`)
  
  // Basic Auth Guard (Optional, but good for redirecting / to /login if needed logic here)
  if (request.nextUrl.pathname === "/") {
     return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next (static files, image optimization, HMR)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next|favicon.ico).*)",
  ],
}