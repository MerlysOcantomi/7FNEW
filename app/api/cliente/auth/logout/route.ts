import { NextResponse } from "next/server"
import { buildClientLogoutCookie } from "@/lib/auth/client-session"

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cookie = buildClientLogoutCookie()
  response.cookies.set(cookie)
  return response
}

export async function GET() {
  const response = NextResponse.redirect(new URL("/cliente/login", process.env.NEXTAUTH_URL || "http://localhost:3000"))
  const cookie = buildClientLogoutCookie()
  response.cookies.set(cookie)
  return response
}
