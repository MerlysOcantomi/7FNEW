import { NextRequest, NextResponse } from "next/server"
import { createSession, buildSessionCookie } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { ensureUserHasDefaultWorkspace } from "@/lib/workspace"

/**
 * TEMP: Dev-only login endpoint for multi-tenant testing.
 * Only works when DISABLE_GOOGLE_AUTH=true.
 * Creates/reuses a User by email and issues a session.
 */
export async function POST(request: NextRequest) {
  if (process.env.DISABLE_GOOGLE_AUTH !== "true") {
    return NextResponse.json(
      { error: "Dev login only available when DISABLE_GOOGLE_AUTH=true" },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()
    const { email, nombre, role } = body as {
      email?: string
      nombre?: string
      role?: string
    }

    if (!email) {
      return NextResponse.json({ error: "email es requerido" }, { status: 400 })
    }

    const validRole = role && ["admin", "editor", "viewer"].includes(role) ? role : "admin"

    let user = await db.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user) {
      await db.allowedEmail.upsert({
        where: { email: email.toLowerCase() },
        update: { role: validRole },
        create: { email: email.toLowerCase(), role: validRole },
      })

      user = await db.user.create({
        data: {
          email: email.toLowerCase(),
          nombre: nombre || email.split("@")[0],
          role: validRole,
          lastLogin: new Date(),
        },
      })
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      })
    }

    const activeWorkspaceId = await ensureUserHasDefaultWorkspace(user.id)

    const token = await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      nombre: user.nombre,
      avatar: user.avatar,
    })

    const cookie = buildSessionCookie(token)
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, nombre: user.nombre },
      workspaceId: activeWorkspaceId,
    })

    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    })
    response.cookies.set("wf_workspace", activeWorkspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

    return response
  } catch (error) {
    console.error("[7F Dev Auth] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de autenticación" },
      { status: 500 },
    )
  }
}
