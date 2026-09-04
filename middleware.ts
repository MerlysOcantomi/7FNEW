import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const INTERNAL_COOKIE = "7f-session"
const CLIENT_COOKIE = "7f-client-session"

/**
 * `/api/inbox/webhooks` (INBOX-TRANSPORT-05D): provider webhook skeletons.
 * Unauthenticated by nature (providers push to them); the route resolves the
 * tenant from [provider, providerAccountId] and currently answers
 * accepted:false — real integrations add per-provider signature checks.
 */
// "/finesse" is the public Finesse landing (FINESSE-WEB-01): a static marketing
// page that reads no workspace/session data. Segment-boundary match only —
// "/finessex" or any private route stays protected.
const PUBLIC_PATHS = ["/login", "/api/auth", "/cliente/login", "/api/cliente/auth", "/api/inbox/public", "/api/inbox/email/inbound", "/api/inbox/webhooks", "/widget", "/sites", "/api/sites", "/finesse"]
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/public"]

/**
 * Segment-boundary prefix match (CORE-02B). A public prefix authorises the
 * path itself and its sub-segments ONLY: "/api/auth" covers "/api/auth" and
 * "/api/auth/callback/google", but never "/api/auth-malicious" or
 * "/api/authx", which a bare `startsWith` would have made public.
 */
function matchesSegmentPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => matchesSegmentPrefix(pathname, p))) return true
  if (PUBLIC_PATHS.some((p) => matchesSegmentPrefix(pathname, p))) return true
  return false
}

/**
 * Fail-closed response for protected APIs when AUTH_SECRET is missing or
 * unusable (CORE-02B, closes F-AUTH-01). Deterministic and generic: no
 * secret name, length or value, no internal detail.
 */
function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Servicio no disponible" } },
    { status: 503 },
  )
}

function isClientPortalRoute(pathname: string): boolean {
  return (pathname === "/cliente" || pathname.startsWith("/cliente/")) ||
         (pathname.startsWith("/api/cliente/"))
}

function getSecret(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET
  // Whitespace-only is as unusable as absent (CORE-02B.1): it would "verify"
  // tokens signed with a blank key. The check trims; the encoded value is the
  // ORIGINAL secret, never a trimmed copy.
  if (!secret || secret.trim().length === 0) return null
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

/**
 * Routes that belong to the SevenF System Admin area (control plane).
 *
 * They are GATED at the Edge using the `platformRole` claim of the JWT, NOT
 * the workspace-scoped `User.role`. Only users with a row in `PlatformAdmin`
 * (and a fresh login that picked up the claim) may pass. Anyone else is
 * bounced to the home page (UI) or rejected with 403 (API).
 *
 * NOTE: this is a fast-path admission gate. Server handlers under
 * `/api/system/**` MUST still call `requirePlatformRole(...)` to re-check the
 * DB so a revoked admin loses access immediately, even if their JWT is fresh.
 */
const PLATFORM_PATHS = ["/system", "/api/system"]

function isPlatformPath(p: string): boolean {
  return PLATFORM_PATHS.some((pp) => p === pp || p.startsWith(pp + "/"))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // NOTE: Presence custom-domain auto-routing is intentionally NOT wired into
  // the middleware. Rewriting "any host not in the env allowlist" hijacked the
  // app's own production domain (e.g. sevenef.com) whenever that host was not
  // listed in NEXT_PUBLIC_APP_URL/VERCEL_URL. Presence sites are reachable via
  // the explicit `/sites/<slug>` (and `/sites/by-host/<host>`) paths only.
  // A safe custom-domain design (explicit verified-domain allowlist) is deferred.

  if (isPublic(pathname)) return NextResponse.next()

  // Client portal routes
  if (isClientPortalRoute(pathname)) {
    // Fail closed BEFORE looking at the token: without a usable secret no
    // portal API may proceed, token or not (CORE-02B).
    const secret = getSecret()
    if (!secret) {
      if (pathname.startsWith("/api/")) {
        return serviceUnavailable()
      }
      return NextResponse.redirect(new URL("/cliente/login?error=config", request.url))
    }

    const token = request.cookies.get(CLIENT_COOKIE)?.value
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/cliente/login", request.url))
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
    // Fail CLOSED (CORE-02B, F-AUTH-01): a protected API must never proceed
    // without a verifiable session. Pages keep the config-error redirect.
    if (pathname.startsWith("/api/")) {
      return serviceUnavailable()
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

    /**
     * Platform gate. Runs AFTER the standard workspace-side checks above so
     * unauthenticated users are bounced to /login first (handled higher up),
     * and only authenticated users without `platformRole` see the platform
     * 403. Tokens issued before this claim existed will simply not have it
     * (`undefined`), which is treated as "not a platform admin" — those
     * users keep working in their workspace as usual.
     */
    if (isPlatformPath(pathname)) {
      const platformRole = payload.platformRole as string | undefined
      if (!platformRole) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { success: false, error: { code: "NOT_PLATFORM_ADMIN", message: "Acceso restringido al control plane" } },
            { status: 403 },
          )
        }
        return NextResponse.redirect(new URL("/?error=forbidden_platform", request.url))
      }
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
