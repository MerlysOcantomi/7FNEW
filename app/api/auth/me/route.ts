import { NextResponse } from "next/server"
import { getSessionFromCookies } from "@/lib/auth/session"

export async function GET() {
  const session = await getSessionFromCookies()

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      nombre: session.nombre,
      avatar: session.avatar,
      /**
       * Read straight off the session JWT — no DB hit. The claim is stamped
       * at login time. `null` for everyone who isn't a PlatformAdmin (the
       * common case). Server-side handlers under `/api/system/**` re-validate
       * against the DB via `requirePlatformRole` for defence in depth.
       */
      platformRole: session.platformRole,
    },
  })
}
