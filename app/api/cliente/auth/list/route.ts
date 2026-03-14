import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { handleError } from "@/lib/api"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess(request)
    const list = await db.clientAuth.findMany({
      where: {
        cliente: {
          workspaceId,
        },
      },
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
  } catch (error) {
    return handleError(error, "ClientAuth")
  }
}
