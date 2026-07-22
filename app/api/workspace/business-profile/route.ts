import { NextRequest, NextResponse } from "next/server"
import { requireReadAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"
import type { WorkspaceBusinessProfile } from "@core/verticals"
import { PRESENCE_SOCIAL_KEYS } from "@engines/presence/social"

/** Keep only known social platforms with a non-empty trimmed value. */
function sanitizeSocial(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== "object") return undefined
  const record = input as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of PRESENCE_SOCIAL_KEYS) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 300)
  }
  return Object.keys(out).length > 0 ? out : {}
}

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
      social: profile.social ?? {},
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
      social,
    } = body as {
      businessName?: string
      businessDescription?: string
      services?: string[]
      tone?: string
      languages?: string[]
      region?: string
      workingHours?: string
      attentionRules?: string[]
      social?: Record<string, string>
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
      // Raw public handles/URLs; validated to safe public URLs at render time.
      social: sanitizeSocial(social),
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
