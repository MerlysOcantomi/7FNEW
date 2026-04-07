import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const INTERNAL_COOKIE = "7f-session"
const CLIENT_COOKIE = "7f-client-session"

const PUBLIC_PATHS = ["/login", "/api/auth", "/cliente/login", "/api/cliente/auth", "/api/inbox/public"]
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/public"]

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
  return false
}

function isClientPortalRoute(pathname: string): boolean {
  return (pathname === "/cliente" || pathname.startsWith("/cliente/")) ||
         (pathname.startsWith("/api/cliente/"))
}

function getSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

const ADMIN_PATHS = ["/admin"]
const EDITOR_PATHS = ["/finanzas", "/facturacion", "/motor", "/calendario", "/contenido", "/agente"]
type Role = "admin" | "editor" | "viewer"
const ROLE_LEVEL: Record<Role, number> = { admin: 3, editor: 2, viewer: 1 }

function getRequiredLevel(p: string): number {
  if (ADMIN_PATHS.some((ap) => p.startsWith(ap))) return ROLE_LEVEL.admin
  if (EDITOR_PATHS.some((ep) => p.startsWith(ep))) return ROLE_LEVEL.editor
  return ROLE_LEVEL.viewer
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  // Client portal routes
  if (isClientPortalRoute(pathname)) {
    const token = request.cookies.get(CLIENT_COOKIE)?.value
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/cliente/login", request.url))
    }

    const secret = getSecret()
    if (!secret) {
      return NextResponse.redirect(new URL("/cliente/login?error=config", request.url))
    }

    try {
      const { payload } = await jwtVerify(token, secret)
      if (payload.type !== "client") {
        return NextResponse.redirect(new URL("/cliente/login", request.url))
      }

      const headers = new Headers(request.headers)
      headers.set("x-client-id", payload.clienteId as string)
      headers.set("x-client-email", payload.email as string)
      return NextResponse.next({ request: { headers } })
    } catch {
      const response = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Sesion expirada" }, { status: 401 })
        : NextResponse.redirect(new URL("/cliente/login", request.url))
      response.cookies.set(CLIENT_COOKIE, "", { path: "/", maxAge: 0 })
      return response
    }
  }

  // Internal routes — Google OAuth authentication
  const secret = getSecret()
  if (!secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/login?error=config", request.url))
  }

  const token = request.cookies.get(INTERNAL_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret)
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
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sesion expirada" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url))
    response.cookies.set(INTERNAL_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
