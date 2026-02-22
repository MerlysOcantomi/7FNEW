import { NextResponse } from "next/server"
import { getSessionFromCookies } from "@/lib/auth/session"

// TODO: Remove temporary admin fallback when Google OAuth is re-enabled
const TEMP_ADMIN_USER = {
  userId: "temp-admin",
  email: "admin@7f.local",
  role: "admin",
  nombre: "Administrador",
  avatar: null,
}

export async function GET() {
  const session = await getSessionFromCookies()

  if (!session) {
    return NextResponse.json({ authenticated: true, user: TEMP_ADMIN_USER })
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
