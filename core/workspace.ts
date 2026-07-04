import { db } from "@core/db"
import {
  parseJsonConfig,
  mergeConfigs,
  getVerticalByKey,
  type VerticalConfig,
  type WorkspaceBusinessProfile,
} from "@core/verticals"
import { resolveLocaleFromConfig, type SupportedLocale } from "@core/i18n"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"

// ---------------------------------------------------------------------------
// Workspace Agent Context — resolved per workspace for Fanny and future agents
// ---------------------------------------------------------------------------

export interface WorkspaceAgentContext {
  identity: {
    name: string
    description: string | null
    vertical: string
    verticalName: string | null
    region: string | null
    languages: string[]
    tone: string | null
    workingHours: string | null
  }
  services: string[]
  attentionRules: string[]
}

export async function resolveWorkspaceContext(
  workspaceId: string,
): Promise<WorkspaceAgentContext | null> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      nombre: true,
      verticalKey: true,
      config: true,
    },
  })
  if (!ws) return null

  const vertical = await getVerticalByKey(ws.verticalKey)
  const defaults = parseJsonConfig(vertical?.defaultConfig)
  const overrides = parseJsonConfig(ws.config)
  const resolved = mergeConfigs(defaults, overrides)

  const profile: WorkspaceBusinessProfile = resolved.businessProfile ?? {}

  return {
    identity: {
      name: profile.businessName || ws.nombre,
      description: profile.businessDescription || null,
      vertical: ws.verticalKey,
      verticalName: vertical?.name || null,
      region: profile.region || null,
      languages: profile.languages ?? [],
      tone: profile.tone || null,
      workingHours: profile.workingHours || null,
    },
    services: profile.services ?? [],
    attentionRules: profile.attentionRules ?? [],
  }
}

const WS_CTX_LABELS: Record<
  SupportedLocale,
  {
    header: string
    company: string
    description: string
    vertical: string
    region: string
    languages: string
    services: string
    tone: string
    hours: string
    rules: string
  }
> = {
  en: {
    header: "WORKSPACE (business identity):",
    company: "Company",
    description: "Description",
    vertical: "Vertical",
    region: "Region",
    languages: "Languages",
    services: "Services",
    tone: "Tone",
    hours: "Hours",
    rules: "Attention rules",
  },
  es: {
    header: "WORKSPACE (quién eres como empresa):",
    company: "Empresa",
    description: "Descripción",
    vertical: "Vertical",
    region: "Región",
    languages: "Idiomas",
    services: "Servicios",
    tone: "Tono",
    hours: "Horario",
    rules: "Reglas de atención",
  },
  de: {
    header: "WORKSPACE (Geschäftsprofil):",
    company: "Unternehmen",
    description: "Beschreibung",
    vertical: "Branche",
    region: "Region",
    languages: "Sprachen",
    services: "Leistungen",
    tone: "Ton",
    hours: "Öffnungszeiten",
    rules: "Service-Regeln",
  },
}

export function buildWorkspaceContextBlock(ctx: WorkspaceAgentContext, locale: SupportedLocale = "en"): string {
  const L = WS_CTX_LABELS[locale] ?? WS_CTX_LABELS.en
  const lines: string[] = []

  lines.push(`- ${L.company}: ${ctx.identity.name}`)
  if (ctx.identity.description) lines.push(`- ${L.description}: ${ctx.identity.description}`)
  if (ctx.identity.verticalName) lines.push(`- ${L.vertical}: ${ctx.identity.verticalName}`)
  if (ctx.identity.region) lines.push(`- ${L.region}: ${ctx.identity.region}`)
  if (ctx.identity.languages.length > 0) lines.push(`- ${L.languages}: ${ctx.identity.languages.join(", ")}`)
  if (ctx.services.length > 0) lines.push(`- ${L.services}: ${ctx.services.slice(0, 15).join(", ")}`)
  if (ctx.identity.tone) lines.push(`- ${L.tone}: ${ctx.identity.tone}`)
  if (ctx.identity.workingHours) lines.push(`- ${L.hours}: ${ctx.identity.workingHours}`)
  if (ctx.attentionRules.length > 0) {
    lines.push(`- ${L.rules}:`)
    for (const rule of ctx.attentionRules.slice(0, 10)) {
      lines.push(`  · ${rule}`)
    }
  }

  return `${L.header}\n${lines.join("\n")}`
}

/**
 * @deprecated Avoid using a global default workspace. Each operation should
 * resolve the workspace from the authenticated user's context. Kept
 * temporarily for the setup/backfill script.
 */
export const DEFAULT_WORKSPACE_ID = "ws_default"

/**
 * @deprecated See DEFAULT_WORKSPACE_ID.
 */
export const DEFAULT_WORKSPACE_SLUG = "default"

/**
 * @deprecated Use `ensureUserHasDefaultWorkspace` instead. This function
 * creates a shared "default" workspace that breaks tenant isolation.
 * Only the setup/backfill script should reference it.
 */
export async function getOrCreateDefaultWorkspace() {
  const existing = await db.workspace.findUnique({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
  })
  if (existing) return existing

  return db.workspace.create({
    data: {
      id: DEFAULT_WORKSPACE_ID,
      nombre: "Default Workspace",
      slug: DEFAULT_WORKSPACE_SLUG,
      vertical: "creative-agency",
      verticalKey: "creative-agency",
    },
  })
}

export async function checkMembership(userId: string, workspaceId: string) {
  return db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true, userId: true, workspaceId: true, role: true, createdAt: true },
  })
}

export async function listWorkspacesForUser(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        select: { id: true, nombre: true, slug: true, vertical: true, verticalKey: true, plan: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })
  return memberships.map((m) => ({ ...m.workspace, role: m.role }))
}

export async function ensureUserHasDefaultWorkspace(userId: string): Promise<string> {
  const existing = await db.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  })
  if (existing) return existing.workspaceId

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, nombre: true },
  })

  const slugBase = (user?.email?.split("@")[0] ?? userId).toLowerCase().replace(/[^a-z0-9-]/g, "-")
  let slug = slugBase
  let attempt = 0
  while (await db.workspace.findUnique({ where: { slug } })) {
    attempt++
    slug = `${slugBase}-${attempt}`
  }

  const ws = await db.workspace.create({
    data: {
      nombre: user?.nombre ? `${user.nombre}'s Workspace` : `Workspace ${slug}`,
      slug,
      vertical: "creative-agency",
      verticalKey: "creative-agency",
    },
  })

  await db.workspaceMember.create({
    data: {
      userId,
      workspaceId: ws.id,
      role: "OWNER",
    },
  })
  return ws.id
}

/**
 * @deprecated This function always returned a hardcoded default, breaking
 * multi-tenancy. Use `getRequiredWorkspaceId` from `@core/workspace-context`
 * instead, which resolves from the authenticated user's session.
 */
export function getActiveWorkspaceId(): string {
  throw new Error(
    "getActiveWorkspaceId is deprecated. Use getRequiredWorkspaceId from @core/workspace-context instead.",
  )
}

export function workspaceFilter(workspaceId: string | null): { workspaceId?: string } {
  if (!workspaceId) return {}
  return { workspaceId }
}

export async function getWorkspaceWithResolvedConfig(workspaceId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      nombre: true,
      slug: true,
      vertical: true,
      verticalKey: true,
      config: true,
      plan: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!ws) return null

  const vertical = await getVerticalByKey(ws.verticalKey)
  const defaults = parseJsonConfig(vertical?.defaultConfig)
  const overrides = parseJsonConfig(ws.config)
  const resolvedConfig = mergeConfigs(defaults, overrides)

  const locale: SupportedLocale = resolveLocaleFromConfig(ws.config)

  // Resolved vertical experience (pure, DB-free) — the shared foundation the
  // /system selector and a future Mr Forte flow read. Does not enable anything
  // by itself; todayMode/theme keys are data.
  const experience = resolveWorkspaceExperience(ws.verticalKey)

  return { ...ws, resolvedConfig, locale, experience }
}

export async function updateWorkspaceConfig(
  workspaceId: string,
  partialConfig: Partial<VerticalConfig>,
) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  if (!ws) return null

  const current = parseJsonConfig(ws.config)
  const merged = mergeConfigs(current, partialConfig as VerticalConfig)

  return db.workspace.update({
    where: { id: workspaceId },
    data: { config: JSON.stringify(merged) },
  })
}

export async function setWorkspaceVertical(workspaceId: string, verticalKey: string) {
  const vertical = await getVerticalByKey(verticalKey)
  if (!vertical || !vertical.isActive) return null

  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { config: true },
  })
  if (!ws) return null

  const newDefaults = parseJsonConfig(vertical.defaultConfig)
  const existingOverrides = parseJsonConfig(ws.config)
  const merged = mergeConfigs(newDefaults, existingOverrides)

  return db.workspace.update({
    where: { id: workspaceId },
    data: {
      vertical: verticalKey,
      verticalKey,
      config: JSON.stringify(merged),
    },
  })
}
