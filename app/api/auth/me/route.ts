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
    },
  })
}
