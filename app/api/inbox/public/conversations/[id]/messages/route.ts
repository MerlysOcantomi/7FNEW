import { NextRequest, NextResponse } from "next/server"
import { db } from "@core/db"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: CORS_HEADERS })
}

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const visitorId = searchParams.get("visitorId")
    const siteKey = searchParams.get("siteKey")

    if (!visitorId || !siteKey) {
      return corsJson(
        { success: false, error: { code: "VALIDATION_ERROR", message: "visitorId and siteKey are required" } },
        { status: 400 },
      )
    }

    const workspace = await db.workspace.findUnique({ where: { slug: siteKey } })
    if (!workspace) {
      return corsJson(
        { success: false, error: { code: "NOT_FOUND", message: "Invalid site key" } },
        { status: 404 },
      )
    }

    const conversation = await db.conversation.findFirst({
      where: {
        id,
        workspaceId: workspace.id,
        channel: "web_chat",
        contact: { source: visitorId },
      },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            direction: true,
            content: true,
            createdAt: true,
          },
        },
      },
    })

    if (!conversation) {
      return corsJson(
        { success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 },
      )
    }

    return corsJson({
      success: true,
      data: {
        conversationId: conversation.id,
        status: conversation.status,
        messages: conversation.messages,
      },
    })
  } catch (error) {
    console.error("[7F] Public chat messages error:", error)
    return corsJson(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal error" } },
      { status: 500 },
    )
  }
}
