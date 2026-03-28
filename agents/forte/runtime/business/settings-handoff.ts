/**
 * Contextual handoff contract between Forte Improvements and Workspace Settings.
 *
 * When Forte recommends an action whose destination is `/administracion`,
 * this module builds a URL with typed query params so the Settings page
 * can render contextual guidance (banner, highlight) without recalculating
 * any business logic.
 *
 * All routing decisions stay in the Forte runtime layer.
 * Settings only consumes the incoming handoff context.
 */

import type { BusinessDomain } from "./domain-types"

// ── Handoff contract ─────────────────────────────────────────────────────────

export interface ForteSettingsHandoff {
  source: "forte"
  domain?: BusinessDomain
  capabilityId?: string
  settingsItemId?: string
  reason?: string
}

// ── Capability → Settings item mapping ───────────────────────────────────────
// Maps Forte semantic capability IDs to the item IDs used in the
// Workspace Settings page (CORE_CAPABILITIES / EXTENSION_PACKS / ADVANCED_ITEMS).
//
// contentMarketing → campanas: the settings page groups content marketing
// under the "Marketing" toggle since there is no separate "Content" item.

const CAPABILITY_TO_SETTINGS_ITEM: Record<string, string> = {
  smartInbox:       "inbox",
  crm:              "clientes",
  portal:           "clientes",
  projectDelivery:  "proyectos",
  taskManagement:   "tareas",
  invoicing:        "facturacion",
  financeControl:   "finanzas",
  contentMarketing: "campanas",
  campaigns:        "campanas",
  documents:        "archivos",
  automations:      "automatizaciones",
  documentAnalysis: "motor",
  aiAssistance:     "motor",
}

export function resolveSettingsItemId(capabilityId: string): string | undefined {
  return CAPABILITY_TO_SETTINGS_ITEM[capabilityId]
}

// ── URL builder ──────────────────────────────────────────────────────────────

export function buildSettingsHandoffUrl(
  handoff: Omit<ForteSettingsHandoff, "source">,
): string {
  const params = new URLSearchParams()
  params.set("from", "forte")

  if (handoff.domain) params.set("domain", handoff.domain)
  if (handoff.capabilityId) params.set("capability", handoff.capabilityId)

  const itemId = handoff.settingsItemId
    ?? (handoff.capabilityId ? resolveSettingsItemId(handoff.capabilityId) : undefined)
  if (itemId) params.set("section", itemId)

  if (handoff.reason) params.set("reason", handoff.reason)

  return `/administracion?${params.toString()}`
}

// ── Parser ───────────────────────────────────────────────────────────────────

export function parseSettingsHandoff(
  params: Record<string, string | string[] | undefined>,
): ForteSettingsHandoff | null {
  const from = typeof params.from === "string" ? params.from : undefined
  if (from !== "forte") return null

  const domain = typeof params.domain === "string" ? params.domain as BusinessDomain : undefined
  const capabilityId = typeof params.capability === "string" ? params.capability : undefined
  const section = typeof params.section === "string" ? params.section : undefined
  const reason = typeof params.reason === "string" ? params.reason : undefined

  return {
    source: "forte",
    domain,
    capabilityId,
    settingsItemId: section,
    reason,
  }
}
