import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, getGoogleUser, getCallbackUrl } from "@core/auth/google"
import { createSession, buildSessionCookie } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { ensureUserHasDefaultWorkspace } from "@/lib/workspace"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const storedState = request.cookies.get("oauth-state")?.value

    if (!code || !state || state !== storedState) {
      console.error("[7F Auth] Invalid state or missing code")
      return NextResponse.redirect(new URL("/login?error=invalid_state", request.url))
    }

    const redirectUri = getCallbackUrl(request.url)
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    const googleUser = await getGoogleUser(tokens.access_token)

    console.log("[7F Auth] Google user:", googleUser.email)

    const allowedEmail = await db.allowedEmail.findUnique({
      where: { email: googleUser.email.toLowerCase() },
    })

    if (!allowedEmail) {
      console.warn("[7F Auth] Access denied for:", googleUser.email)
      return NextResponse.redirect(new URL("/login?error=not_allowed", request.url))
    }

    let user = await db.user.findUnique({
      where: { email: googleUser.email.toLowerCase() },
    })

    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          nombre: googleUser.name,
          avatar: googleUser.picture,
          role: allowedEmail.role,
          lastLogin: new Date(),
        },
      })
    } else {
      user = await db.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          nombre: googleUser.name,
          avatar: googleUser.picture,
          role: allowedEmail.role,
          lastLogin: new Date(),
        },
      })
    }

    const activeWorkspaceId = await ensureUserHasDefaultWorkspace(user.id)
    console.log("[7F Auth] Session created for:", user.email, "role:", user.role, "workspace:", activeWorkspaceId)

    const token = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      avatar: user.avatar,
    })

    const response = NextResponse.redirect(new URL("/", request.url))
    const cookie = buildSessionCookie(token)
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    })
    response.cookies.delete("oauth-state")
    response.cookies.set("wf_workspace", activeWorkspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("[7F Auth] Callback error:", msg, error)
    return NextResponse.redirect(new URL(`/login?error=auth_failed&detail=${encodeURIComponent(msg)}`, request.url))
  }
}
