import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"

export async function POST(request: NextRequest) {
  try {
    const { clienteId, email, password } = await request.json()

    if (!clienteId || !email || !password) {
      return NextResponse.json(
        { error: "clienteId, email y password son requeridos" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      )
    }

    const cliente = await db.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const existing = await db.clientAuth.findFirst({
      where: { OR: [{ email: email.toLowerCase().trim() }, { clienteId }] },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Este cliente o email ya tiene acceso al portal" },
        { status: 409 }
      )
    }

    const passwordHash = hashPassword(password)
    const clientAuth = await db.clientAuth.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        clienteId,
      },
    })

    return NextResponse.json({
      success: true,
      id: clientAuth.id,
      email: clientAuth.email,
      clienteId: clientAuth.clienteId,
    })
  } catch (error) {
    console.error("Client register error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
