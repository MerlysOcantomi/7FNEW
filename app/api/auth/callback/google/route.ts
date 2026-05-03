import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, getGoogleUser, getCallbackUrl } from "@core/auth/google"
import { createSession, buildSessionCookie } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { checkMembership, ensureUserHasDefaultWorkspace } from "@/lib/workspace"

/** Default invite-only when unset (preserves existing deployments). Self-serve only when `AUTH_INVITE_ONLY=false`. */
function isAuthInviteOnly(): boolean {
  const v = process.env.AUTH_INVITE_ONLY?.trim().toLowerCase()
  if (v === "false") return false
  return true
}

/** Platform `User.role` for new self-serve signups (middleware RBAC). */
function defaultSelfServeUserRole(): string {
  const r = process.env.AUTH_DEFAULT_USER_ROLE?.trim().toLowerCase()
  if (r && ["admin", "editor", "viewer"].includes(r)) return r
  return "viewer"
}

/**
 * Bootstrap helper for the SevenF System Admin area.
 *
 * `PLATFORM_BOOTSTRAP_EMAILS` is an opt-in CSV of emails that get auto-promoted
 * to `PlatformAdmin{role: "SUPER_ADMIN"}` on first login. After the first
 * successful bootstrap login in production the env var SHOULD be cleared so
 * the door doesn't stay propped open. Existing PlatformAdmin rows are never
 * downgraded — this only PROMOTES, never demotes.
 *
 * Returns the platform role the user should carry in their session JWT
 * (`null` for everyone who isn't a PlatformAdmin).
 */
async function resolvePlatformRoleForLogin(
  userId: string,
  emailLower: string,
): Promise<string | null> {
  const raw = process.env.PLATFORM_BOOTSTRAP_EMAILS ?? ""
  const bootstrapEmails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (bootstrapEmails.includes(emailLower)) {
    const existing = await db.platformAdmin.findUnique({ where: { userId } })
    if (!existing) {
      try {
        await db.platformAdmin.create({
          data: {
            userId,
            role: "SUPER_ADMIN",
            createdBy: "bootstrap-env",
          },
        })
        console.warn(
          "[7F Platform] Bootstrap promoted user to SUPER_ADMIN via PLATFORM_BOOTSTRAP_EMAILS:",
          emailLower,
        )
      } catch (err) {
        /**
         * Bootstrap failure must NOT block login. The user just signs in
         * without a platform role and we log the cause for ops triage.
         */
        console.error("[7F Platform] Bootstrap insert failed:", err)
      }
    }
  }

  const row = await db.platformAdmin.findUnique({
    where: { userId },
    select: { role: true },
  })
  return row?.role ?? null
}

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

    const inviteOnly = isAuthInviteOnly()
    const emailLower = googleUser.email.toLowerCase()

    let allowedEmail: { role: string } | null = null
    if (inviteOnly) {
      allowedEmail = await db.allowedEmail.findUnique({
        where: { email: emailLower },
      })
      if (!allowedEmail) {
        console.warn("[7F Auth] Access denied (invite-only, not on allowlist):", googleUser.email)
        return NextResponse.redirect(new URL("/login?error=not_allowed", request.url))
      }
    }

    let user = await db.user.findUnique({
      where: { email: emailLower },
    })

    if (user) {
      const updateData: {
        nombre: string
        avatar: string
        lastLogin: Date
        role?: string
      } = {
        nombre: googleUser.name,
        avatar: googleUser.picture,
        lastLogin: new Date(),
      }
      if (inviteOnly && allowedEmail) {
        updateData.role = allowedEmail.role
      }
      user = await db.user.update({
        where: { id: user.id },
        data: updateData,
      })
    } else {
      const role =
        inviteOnly && allowedEmail ? allowedEmail.role : defaultSelfServeUserRole()
      user = await db.user.create({
        data: {
          email: emailLower,
          nombre: googleUser.name,
          avatar: googleUser.picture,
          role,
          lastLogin: new Date(),
        },
      })
    }

    let activeWorkspaceId = await ensureUserHasDefaultWorkspace(user.id)
    const preferredWorkspaceId = process.env.AUTH_PREFERRED_WORKSPACE_ID?.trim()
    if (preferredWorkspaceId) {
      const preferredMember = await checkMembership(user.id, preferredWorkspaceId)
      if (preferredMember) activeWorkspaceId = preferredWorkspaceId
    }

    /**
     * Stamp `PlatformAdmin.role` (if any) into the JWT claim so middleware in
     * the Edge can gate `/system` without DB access. Bootstrap by env var
     * also happens here, only promoting (never demoting) listed emails.
     */
    const platformRole = await resolvePlatformRoleForLogin(user.id, emailLower)
    console.log(
      "[7F Auth] Session created for:",
      user.email,
      "role:",
      user.role,
      "platform:",
      platformRole ?? "none",
      "workspace:",
      activeWorkspaceId,
    )

    const token = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      avatar: user.avatar,
      platformRole,
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
