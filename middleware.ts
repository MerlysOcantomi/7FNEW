import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "7f-session"

const PUBLIC_PATHS = ["/login", "/api/auth"]
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/public"]

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
  return false
}

const ADMIN_PATHS = ["/admin"]
const EDITOR_PATHS = ["/finanzas", "/facturacion", "/motor", "/calendario"]

type Role = "admin" | "editor" | "viewer"
const ROLE_LEVEL: Record<Role, number> = { admin: 3, editor: 2, viewer: 1 }

function getRequiredLevel(pathname: string): number {
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) return ROLE_LEVEL.admin
  if (EDITOR_PATHS.some((p) => pathname.startsWith(p))) return ROLE_LEVEL.editor
  return ROLE_LEVEL.viewer
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    const secret = process.env.AUTH_SECRET
    if (!secret) {
      return NextResponse.redirect(new URL("/login?error=config", request.url))
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    const userRole = (payload.role as string) ?? "viewer"
    const userLevel = ROLE_LEVEL[userRole as Role] ?? 1
    const requiredLevel = getRequiredLevel(pathname)

    if (userLevel < requiredLevel) {
      return NextResponse.redirect(new URL("/?error=forbidden", request.url))
    }

    const headers = new Headers(request.headers)
    headers.set("x-user-id", payload.userId as string)
    headers.set("x-user-email", payload.email as string)
    headers.set("x-user-role", userRole)

    return NextResponse.next({ request: { headers } })
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url))
    response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 })
    return response
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
