import { NextResponse } from "next/server"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET() {
  const session = await getClientSessionFromCookies()

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      clienteId: session.clienteId,
      email: session.email,
      nombre: session.nombre,
    },
  })
}
