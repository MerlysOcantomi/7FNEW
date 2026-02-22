import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const COOKIE_NAME = "7f-client-session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface ClientSession {
  clientAuthId: string
  clienteId: string
  email: string
  nombre: string
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET no configurada")
  return new TextEncoder().encode(secret)
}

export async function createClientSession(user: ClientSession): Promise<string> {
  return new SignJWT({
    clientAuthId: user.clientAuthId,
    clienteId: user.clienteId,
    email: user.email,
    nombre: user.nombre,
    type: "client",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret())
}

export async function verifyClientSession(token: string): Promise<ClientSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.type !== "client") return null
    return {
      clientAuthId: payload.clientAuthId as string,
      clienteId: payload.clienteId as string,
      email: payload.email as string,
      nombre: payload.nombre as string,
    }
  } catch {
    return null
  }
}

export async function getClientSessionFromCookies(): Promise<ClientSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyClientSession(token)
}

export async function getClientSessionFromRequest(request: NextRequest): Promise<ClientSession | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyClientSession(token)
}

export function buildClientSessionCookie(token: string) {
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

export function buildClientLogoutCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  }
}

export const CLIENT_COOKIE_NAME = COOKIE_NAME
