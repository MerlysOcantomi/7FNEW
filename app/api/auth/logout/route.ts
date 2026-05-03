import { NextRequest, NextResponse } from "next/server"
import { buildLogoutCookie } from "@/lib/auth/session"
import { WORKSPACE_COOKIE } from "@/lib/workspace-context"

/**
 * Build the redirect response that signs the user out. Both the session cookie
 * and the active-workspace cookie are cleared on the same response so the next
 * request from this browser cannot accidentally inherit a previous tenant
 * context. This is critical for shared devices and for the Google account
 * switch case: a different Google user signing in afterwards must not start
 * out with the previous user's `wf_workspace` cookie still set, even for the
 * brief window before the OAuth callback overwrites it.
 *
 * Both `POST` and `GET` produce the same effect — `POST` is used by the Sign
 * out menu item (form-style action), `GET` exists so a plain `<a href>` or a
 * direct browser visit still works.
 */
function buildLogoutResponse(request: NextRequest): NextResponse {
  const cookie = buildLogoutCookie()
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    maxAge: cookie.maxAge,
  })
  response.cookies.set(WORKSPACE_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })
  return response
}

export async function POST(request: NextRequest) {
  return buildLogoutResponse(request)
}

export async function GET(request: NextRequest) {
  return buildLogoutResponse(request)
}
