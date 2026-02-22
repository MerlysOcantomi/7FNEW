import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/auth/password"
import { createClientSession, buildClientSessionCookie } from "@/lib/auth/client-session"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }

    const clientAuth = await db.clientAuth.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { cliente: true },
    })

    if (!clientAuth) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 })
    }

    const valid = verifyPassword(password, clientAuth.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 })
    }

    await db.clientAuth.update({
      where: { id: clientAuth.id },
      data: { lastLogin: new Date() },
    })

    const token = await createClientSession({
      clientAuthId: clientAuth.id,
      clienteId: clientAuth.clienteId,
      email: clientAuth.email,
      nombre: clientAuth.cliente.nombre,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        clienteId: clientAuth.clienteId,
        email: clientAuth.email,
        nombre: clientAuth.cliente.nombre,
      },
    })

    const cookie = buildClientSessionCookie(token)
    response.cookies.set(cookie)

    return response
  } catch (error) {
    console.error("Client login error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
