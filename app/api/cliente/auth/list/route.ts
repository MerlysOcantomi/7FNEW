import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const list = await db.clientAuth.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      clienteId: true,
      lastLogin: true,
      createdAt: true,
      cliente: { select: { nombre: true } },
    },
  })

  return NextResponse.json(list)
}
