import { NextRequest, NextResponse } from "next/server"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"

export async function GET() {
  try {
    const { workspaceId } = await requireAdminAccess()
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { nombre: true, verticalKey: true, config: true },
    })

    if (!workspace || workspace.verticalKey !== "beauty") {
      return NextResponse.json({ error: "Finesse workspace not found" }, { status: 404 })
    }

    const config = parseJsonConfig(workspace.config)
    const onboarding = (config.onboarding ?? {}) as Record<string, unknown>
    const profile = config.businessProfile ?? {}

    return NextResponse.json({
      status: onboarding.status ?? "not_started",
      businessName: profile.businessName ?? workspace.nombre,
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()
    const body = (await request.json()) as { businessName?: unknown }
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : ""

    if (!businessName || businessName.length > 120) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 })
    }

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { verticalKey: true, config: true },
    })

    if (!workspace || workspace.verticalKey !== "beauty") {
      return NextResponse.json({ error: "Finesse workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(workspace.config)
    const existingProfile = current.businessProfile ?? {}
    const existingOnboarding =
      current.onboarding && typeof current.onboarding === "object"
        ? (current.onboarding as Record<string, unknown>)
        : {}

    const completedAt = new Date().toISOString()

    await db.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { nombre: businessName },
      })
    })

    await updateWorkspaceConfig(workspaceId, {
      ...current,
      businessProfile: {
        ...existingProfile,
        businessName,
      },
      onboarding: {
        ...existingOnboarding,
        product: "finesse",
        status: "completed",
        completedAt,
      },
    })

    return NextResponse.json({ ok: true, redirectTo: "/today" })
  } catch (error) {
    console.error("[Finesse onboarding] completion failed", error)
    return NextResponse.json({ error: "Unable to complete onboarding" }, { status: 500 })
  }
}
