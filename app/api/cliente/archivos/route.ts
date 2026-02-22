import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"

export async function GET() {
  const session = await getClientSessionFromCookies()
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [documentos, attachments] = await Promise.all([
    db.documento.findMany({
      where: { clienteId: session.clienteId },
      orderBy: { createdAt: "desc" },
    }),
    db.attachment.findMany({
      where: { module: "clientes", recordId: session.clienteId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({ documentos, attachments })
}
