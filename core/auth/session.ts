import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const COOKIE_NAME = "7f-session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  userId: string
  email: string
  role: string
  nombre: string | null
  avatar: string | null
  /**
   * Optional platform-level role from `PlatformAdmin.role`. Stamped at login
   * time. `null` for regular users (vast majority).
   *
   * Why a JWT claim and not a per-request DB lookup: the middleware runs in
   * the Edge runtime where Prisma is unavailable. Carrying `platformRole` in
   * the signed token lets the middleware gate `/system` and `/api/system`
   * without round-tripping to the database.
   *
   * Trade-off: if a user is promoted/demoted in `PlatformAdmin` AFTER they
   * received their current JWT, the change does not take effect until they
   * re-login. Server-side handlers under `/api/system/**` MUST therefore
   * still re-validate against the DB via `requirePlatformRole` (defence in
   * depth) — the JWT is only a fast-path admission gate.
   */
  platformRole: string | null
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET no configurada")
  return new TextEncoder().encode(secret)
}

export async function createSession(
  user: SessionUser,
  /**
   * Optional session lifetime in seconds. Defaults to 7 days, preserving every
   * existing caller. Mr Forte Lab (DEV-PREVIEW-01C) passes a shorter value so
   * the demo app session never outlives its lab access window.
   */
  expiresInSeconds?: number,
): Promise<string> {
  const token = await new SignJWT({
    userId: user.userId,
    email: user.email,
    role: user.role,
    nombre: user.nombre,
    avatar: user.avatar,
    platformRole: user.platformRole,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(
      expiresInSeconds && expiresInSeconds > 0
        ? Math.floor(Date.now() / 1000) + Math.floor(expiresInSeconds)
        : "7d",
    )
    .sign(getSecret())

  return token
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      nombre: (payload.nombre as string) ?? null,
      avatar: (payload.avatar as string) ?? null,
      /**
       * Backwards-compatible: tokens issued before this field existed will
       * decode to `undefined` and we coerce to `null`. Those users keep their
       * current session and gain `platformRole` on next login.
       */
      platformRole: (payload.platformRole as string | undefined) ?? null,
    }
  } catch {
    return null
  }
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export function buildSessionCookie(token: string, maxAgeSeconds?: number) {
  const isProduction = process.env.NODE_ENV === "production"
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds && maxAgeSeconds > 0 ? Math.floor(maxAgeSeconds) : COOKIE_MAX_AGE,
  }
}

export function buildLogoutCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  }
}
