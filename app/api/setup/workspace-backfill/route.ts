import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getOrCreateDefaultWorkspace } from "@/lib/workspace"
import { requireOwnerAccess } from "@/lib/auth/workspace-auth"

export async function POST(request: Request) {
  try {
    await requireOwnerAccess(request)
    const workspace = await getOrCreateDefaultWorkspace()

    const tables = [
      "cliente",
      "proyecto",
      "tarea",
      "documento",
      "transaccion",
      "factura",
      "evento",
      "nota",
      "automatizacion",
      "notification",
      "activity",
      "inboxEntry",
      "contact",
      "conversation",
      "message",
      "conversationAction",
      "aIClassification",
      "attachment",
      "campaign",
      "contentPiece",
      "contentIdea",
    ] as const

    const results: Record<string, number> = {}

    for (const table of tables) {
      const result = await (db[table] as any).updateMany({
        where: { workspaceId: null },
        data: { workspaceId: workspace.id },
      })
      results[table] = result.count
    }

    const userResult = await db.user.updateMany({
      where: { workspaceId: null },
      data: { workspaceId: workspace.id },
    })
    results["user"] = userResult.count

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      backfilled: results,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Backfill failed" },
      { status: 500 }
    )
  }
}
