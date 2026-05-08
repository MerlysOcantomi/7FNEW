import { NextRequest, NextResponse } from "next/server"
import { requireReadAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"
import type { WorkspaceBusinessProfile } from "@core/verticals"

export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { nombre: true, config: true },
    })
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const config = parseJsonConfig(ws.config)
    const profile: WorkspaceBusinessProfile = config.businessProfile ?? {}

    return NextResponse.json({
      businessName: profile.businessName ?? ws.nombre,
      businessDescription: profile.businessDescription ?? "",
      services: profile.services ?? [],
      tone: profile.tone ?? "",
      languages: profile.languages ?? [],
      region: profile.region ?? "",
      workingHours: profile.workingHours ?? "",
      attentionRules: profile.attentionRules ?? [],
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()

    const body = await request.json()
    const {
      businessName,
      businessDescription,
      services,
      tone,
      languages,
      region,
      workingHours,
      attentionRules,
    } = body as {
      businessName?: string
      businessDescription?: string
      services?: string[]
      tone?: string
      languages?: string[]
      region?: string
      workingHours?: string
      attentionRules?: string[]
    }

    const profile: WorkspaceBusinessProfile = {
      businessName: businessName?.trim() || undefined,
      businessDescription: businessDescription?.trim() || undefined,
      services: Array.isArray(services)
        ? services.map((s: string) => s.trim()).filter(Boolean).slice(0, 20)
        : undefined,
      tone: tone?.trim() || undefined,
      languages: Array.isArray(languages)
        ? languages.map((l: string) => l.trim()).filter(Boolean)
        : undefined,
      region: region?.trim() || undefined,
      workingHours: workingHours?.trim() || undefined,
      attentionRules: Array.isArray(attentionRules)
        ? attentionRules.map((r: string) => r.trim()).filter(Boolean).slice(0, 20)
        : undefined,
    }

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true },
    })
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(ws.config)
    const existingProfile = current.businessProfile ?? {}
    const merged = { ...existingProfile, ...profile }

    await updateWorkspaceConfig(workspaceId, {
      ...current,
      businessProfile: merged,
    })

    return NextResponse.json({ ok: true, businessProfile: merged })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
