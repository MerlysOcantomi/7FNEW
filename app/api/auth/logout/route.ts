import { NextRequest, NextResponse } from "next/server"
import { buildLogoutCookie } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  const cookie = buildLogoutCookie()
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  return response
}

export async function GET(request: NextRequest) {
  const cookie = buildLogoutCookie()
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  response.cookies.set("wf_workspace", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })
  return response
}
