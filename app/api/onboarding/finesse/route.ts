import { NextRequest, NextResponse } from "next/server"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { parseJsonConfig, type WorkspaceBusinessProfile } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"

type ActivationChoice = "ready" | "later" | "existing" | "pending"

interface FinesseOnboardingPayload {
  currentStep?: string
  businessName?: string
  businessDescription?: string
  region?: string
  workingHours?: string
  services?: string[]
  presence?: ActivationChoice
  google?: ActivationChoice
  assistant?: ActivationChoice
  channels?: ActivationChoice
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

function cleanServices(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim().slice(0, 120)
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
    if (out.length >= 20) break
  }
  return out
}

function cleanChoice(value: unknown): ActivationChoice | undefined {
  return value === "ready" || value === "later" || value === "existing" || value === "pending"
    ? value
    : undefined
}

async function loadWorkspace(workspaceId: string) {
  return db.workspace.findUnique({
    where: { id: workspaceId },
    select: { nombre: true, verticalKey: true, config: true },
  })
}

function buildProfile(current: WorkspaceBusinessProfile, body: FinesseOnboardingPayload) {
  return {
    ...current,
    businessName: cleanString(body.businessName, 120) ?? current.businessName,
    businessDescription:
      cleanString(body.businessDescription, 600) ?? current.businessDescription,
    region: cleanString(body.region, 200) ?? current.region,
    workingHours: cleanString(body.workingHours, 200) ?? current.workingHours,
    services: cleanServices(body.services) ?? current.services,
  } satisfies WorkspaceBusinessProfile
}

function buildOnboarding(
  current: Record<string, unknown>,
  body: FinesseOnboardingPayload,
  status: "in_progress" | "completed",
) {
  const activation =
    current.activation && typeof current.activation === "object"
      ? (current.activation as Record<string, unknown>)
      : {}

  return {
    ...current,
    product: "finesse",
    status,
    currentStep: cleanString(body.currentStep, 50) ?? current.currentStep ?? "welcome",
    activation: {
      ...activation,
      presence: cleanChoice(body.presence) ?? activation.presence,
      google: cleanChoice(body.google) ?? activation.google,
      assistant: cleanChoice(body.assistant) ?? activation.assistant,
      channels: cleanChoice(body.channels) ?? activation.channels,
    },
    updatedAt: new Date().toISOString(),
    ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}),
  }
}

export async function GET() {
  try {
    const { workspaceId } = await requireAdminAccess()
    const workspace = await loadWorkspace(workspaceId)

    if (!workspace || workspace.verticalKey !== "beauty") {
      return NextResponse.json({ error: "Finesse workspace not found" }, { status: 404 })
    }

    const config = parseJsonConfig(workspace.config)
    const onboarding =
      config.onboarding && typeof config.onboarding === "object"
        ? (config.onboarding as Record<string, unknown>)
        : {}
    const activation =
      onboarding.activation && typeof onboarding.activation === "object"
        ? (onboarding.activation as Record<string, unknown>)
        : {}
    const profile = config.businessProfile ?? {}

    return NextResponse.json({
      status: onboarding.status ?? "not_started",
      currentStep: onboarding.currentStep ?? "welcome",
      profile: {
        businessName: profile.businessName ?? workspace.nombre,
        businessDescription: profile.businessDescription ?? "",
        region: profile.region ?? "",
        workingHours: profile.workingHours ?? "",
        services: profile.services ?? [],
      },
      activation: {
        presence: activation.presence ?? "pending",
        google: activation.google ?? "pending",
        assistant: activation.assistant ?? "pending",
        channels: activation.channels ?? "pending",
      },
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()
    const body = (await request.json()) as FinesseOnboardingPayload
    const workspace = await loadWorkspace(workspaceId)

    if (!workspace || workspace.verticalKey !== "beauty") {
      return NextResponse.json({ error: "Finesse workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(workspace.config)
    const currentProfile = current.businessProfile ?? {}
    const currentOnboarding =
      current.onboarding && typeof current.onboarding === "object"
        ? (current.onboarding as Record<string, unknown>)
        : {}

    const profile = buildProfile(currentProfile, body)
    const onboarding = buildOnboarding(currentOnboarding, body, "in_progress")

    if (profile.businessName && profile.businessName !== workspace.nombre) {
      await db.workspace.update({
        where: { id: workspaceId },
        data: { nombre: profile.businessName },
      })
    }

    await updateWorkspaceConfig(workspaceId, {
      ...current,
      businessProfile: profile,
      onboarding,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Finesse onboarding] save failed", error)
    return NextResponse.json({ error: "Unable to save onboarding" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()
    const body = (await request.json()) as FinesseOnboardingPayload
    const workspace = await loadWorkspace(workspaceId)

    if (!workspace || workspace.verticalKey !== "beauty") {
      return NextResponse.json({ error: "Finesse workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(workspace.config)
    const currentProfile = current.businessProfile ?? {}
    const currentOnboarding =
      current.onboarding && typeof current.onboarding === "object"
        ? (current.onboarding as Record<string, unknown>)
        : {}

    const profile = buildProfile(currentProfile, body)
    if (!profile.businessName?.trim()) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 })
    }

    if (profile.businessName !== workspace.nombre) {
      await db.workspace.update({
        where: { id: workspaceId },
        data: { nombre: profile.businessName },
      })
    }

    await updateWorkspaceConfig(workspaceId, {
      ...current,
      businessProfile: profile,
      onboarding: buildOnboarding(currentOnboarding, body, "completed"),
    })

    return NextResponse.json({ ok: true, redirectTo: "/today" })
  } catch (error) {
    console.error("[Finesse onboarding] completion failed", error)
    return NextResponse.json({ error: "Unable to complete onboarding" }, { status: 500 })
  }
}
