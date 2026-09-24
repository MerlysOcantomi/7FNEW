import { db } from "@core/db"
import {
  FANNY_ACTION_CATALOG,
  FANNY_AUTONOMY_MODES,
  clampFannyMode,
  isFannyOperationId,
  type FannyAutonomyMode,
  type FannyOperationId,
} from "./fanny-action-catalog"

export const FANNY_AUTONOMY_TRIGGER = "fanny.action" as const

export interface FannyAutonomyConditions {
  actionId: FannyOperationId
  channels?: string[]
  urgency?: string[]
  minConfidence?: number
}

export interface FannyAutonomyActionConfig {
  mode: FannyAutonomyMode
  params?: Record<string, unknown>
}

export interface FannyAutonomyRuleRecord {
  id: string
  name: string
  description: string | null
  enabled: boolean
  conditions: FannyAutonomyConditions
  action: FannyAutonomyActionConfig
}

export interface FannyAutonomyContext {
  actionId: FannyOperationId
  channel?: string | null
  urgency?: string | null
  confidence?: number | null
}

export interface ResolvedFannyAutonomy {
  actionId: FannyOperationId
  mode: FannyAutonomyMode
  source: "catalog_default" | "workspace_rule"
  ruleId: string | null
  params: Record<string, unknown>
  reason: string
}

function safeParseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
  return out.length > 0 ? out : undefined
}

function normalizeConditions(value: unknown): FannyAutonomyConditions | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  if (!isFannyOperationId(raw.actionId)) return null
  const minConfidence =
    typeof raw.minConfidence === "number" && Number.isFinite(raw.minConfidence)
      ? Math.max(0, Math.min(1, raw.minConfidence))
      : undefined
  return {
    actionId: raw.actionId,
    channels: normalizeStringArray(raw.channels),
    urgency: normalizeStringArray(raw.urgency),
    minConfidence,
  }
}

function normalizeActionConfig(value: unknown): FannyAutonomyActionConfig | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue || typeof rawValue !== "object") return null
  const raw = rawValue as Record<string, unknown>
  const mode = typeof raw.mode === "string" && (FANNY_AUTONOMY_MODES as readonly string[]).includes(raw.mode)
    ? (raw.mode as FannyAutonomyMode)
    : null
  if (!mode) return null
  const params =
    raw.params && typeof raw.params === "object" && !Array.isArray(raw.params)
      ? (raw.params as Record<string, unknown>)
      : undefined
  return { mode, params }
}

export async function listFannyAutonomyRules(
  workspaceId: string,
): Promise<FannyAutonomyRuleRecord[]> {
  const rows = await db.automatizacion.findMany({
    where: {
      workspaceId,
      trigger: FANNY_AUTONOMY_TRIGGER,
    },
    orderBy: { createdAt: "asc" },
  })

  const out: FannyAutonomyRuleRecord[] = []
  for (const row of rows) {
    const conditions = normalizeConditions(safeParseJson(row.condiciones))
    const action = normalizeActionConfig(safeParseJson(row.acciones))
    if (!conditions || !action) continue
    out.push({
      id: row.id,
      name: row.nombre,
      description: row.descripcion,
      enabled: row.estado === "activa",
      conditions,
      action,
    })
  }
  return out
}

function ruleMatches(rule: FannyAutonomyRuleRecord, context: FannyAutonomyContext): boolean {
  if (!rule.enabled || rule.conditions.actionId !== context.actionId) return false
  if (
    rule.conditions.channels?.length
    && (!context.channel || !rule.conditions.channels.includes(context.channel))
  ) return false
  if (
    rule.conditions.urgency?.length
    && (!context.urgency || !rule.conditions.urgency.includes(context.urgency))
  ) return false
  if (
    typeof rule.conditions.minConfidence === "number"
    && (typeof context.confidence !== "number" || context.confidence < rule.conditions.minConfidence)
  ) return false
  return true
}

/**
 * Resolve autonomy for one action.
 *
 * Rules are evaluated in creation order and progressively make the policy
 * stricter or more specific. They can NEVER widen beyond the action catalog:
 * - planned/preparable actions stay suggest-only;
 * - a rule cannot select a mode outside allowedModes;
 * - an auto threshold may only become stricter than the catalog minimum.
 */
export async function resolveFannyAutonomy(
  workspaceId: string,
  context: FannyAutonomyContext,
): Promise<ResolvedFannyAutonomy> {
  const def = FANNY_ACTION_CATALOG[context.actionId]
  const rules = await listFannyAutonomyRules(workspaceId)

  let mode = def.defaultMode
  let source: ResolvedFannyAutonomy["source"] = "catalog_default"
  let ruleId: string | null = null
  let params: Record<string, unknown> = {}

  for (const rule of rules) {
    if (!ruleMatches(rule, context)) continue
    const nextMode = clampFannyMode(context.actionId, rule.action.mode)
    mode = nextMode
    source = "workspace_rule"
    ruleId = rule.id
    params = { ...params, ...(rule.action.params ?? {}) }
  }

  if (mode === "auto") {
    const minConfidence = Math.max(
      def.minAutoConfidence ?? 0,
      ...rules
        .filter((rule) => ruleMatches(rule, context))
        .map((rule) => rule.conditions.minConfidence ?? 0),
    )
    if (
      typeof context.confidence !== "number"
      || context.confidence < minConfidence
    ) {
      mode = def.allowedModes.includes("confirm") ? "confirm" : "suggest"
    }

    for (const required of def.autoRequiresParams ?? []) {
      const value = params[required]
      if (typeof value !== "string" || !value.trim()) {
        mode = def.allowedModes.includes("confirm") ? "confirm" : "suggest"
        break
      }
    }
  }

  return {
    actionId: context.actionId,
    mode,
    source,
    ruleId,
    params,
    reason:
      source === "workspace_rule"
        ? `workspace_rule:${ruleId ?? "unknown"}`
        : `catalog_default:${def.defaultMode}`,
  }
}

export async function upsertFannyAutonomyRule(input: {
  workspaceId: string
  actionId: FannyOperationId
  mode: FannyAutonomyMode
  channels?: string[]
  urgency?: string[]
  minConfidence?: number
  params?: Record<string, unknown>
}) {
  const def = FANNY_ACTION_CATALOG[input.actionId]
  const mode = clampFannyMode(input.actionId, input.mode)
  const minConfidence =
    typeof input.minConfidence === "number"
      ? Math.max(def.minAutoConfidence ?? 0, Math.max(0, Math.min(1, input.minConfidence)))
      : def.minAutoConfidence

  const conditions: FannyAutonomyConditions = {
    actionId: input.actionId,
    ...(input.channels?.length ? { channels: input.channels } : {}),
    ...(input.urgency?.length ? { urgency: input.urgency } : {}),
    ...(typeof minConfidence === "number" ? { minConfidence } : {}),
  }
  const action: FannyAutonomyActionConfig = {
    mode,
    ...(input.params ? { params: input.params } : {}),
  }

  const existing = await db.automatizacion.findFirst({
    where: {
      workspaceId: input.workspaceId,
      trigger: FANNY_AUTONOMY_TRIGGER,
      nombre: `fanny:${input.actionId}`,
    },
  })

  const data = {
    nombre: `fanny:${input.actionId}`,
    descripcion: `Autonomy policy for Fanny action ${input.actionId}`,
    trigger: FANNY_AUTONOMY_TRIGGER,
    condiciones: JSON.stringify(conditions),
    acciones: JSON.stringify(action),
    estado: "activa",
    workspaceId: input.workspaceId,
  } as const

  if (existing) {
    return db.automatizacion.update({
      where: { id: existing.id },
      data,
    })
  }
  return db.automatizacion.create({ data })
}
