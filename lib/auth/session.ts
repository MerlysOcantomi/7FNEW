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
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET no configurada")
  return new TextEncoder().encode(secret)
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.userId,
    email: user.email,
    role: user.role,
    nombre: user.nombre,
    avatar: user.avatar,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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

export function buildSessionCookie(token: string) {
  const isProduction = process.env.NODE_ENV === "production"
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
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
