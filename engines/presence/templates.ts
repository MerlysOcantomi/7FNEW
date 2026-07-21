/**
 * Sevenef Presence — template registry & families (FOUNDATION).
 *
 * A PresenceTemplate is a versioned, declarative composition of registry
 * sections + compatible themes for a given family. Templates are VERSIONED so a
 * published site can pin the exact version it was built with (see
 * `PresenceSite.templateVersion` / `PresencePublication.templateVersion`).
 *
 * The four initial FAMILIES the architecture must eventually serve are declared
 * here as `status: "foundation"` placeholders — honest, not "ready" (no visual
 * design is built in this PR). This is only the contract + registry that lets
 * the real templates land later without a redesign.
 *
 * Guardrail: no drag-and-drop builder, no free CMS. Templates are curated
 * compositions, not an open page editor.
 */

import { PRESENCE_SECTION_KINDS, type PresenceSectionKind } from "./sections"

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

/**
 * The template families the shared engine must be able to serve. The first
 * three are 7F's own product landings; the fourth is the generated sites for
 * client businesses (the main Presence product).
 */
export const PRESENCE_TEMPLATE_FAMILIES = [
  "sevenef-platform-landing",
  "finesse-vertical-landing",
  "smart-inbox-product-landing",
  "business-site",
] as const
export type PresenceTemplateFamily = (typeof PRESENCE_TEMPLATE_FAMILIES)[number]

/** Lifecycle of a template within the registry. */
export const PRESENCE_TEMPLATE_STATUSES = [
  "foundation", // contract exists, visual design not built yet
  "active", // usable in production
  "deprecated", // superseded, still resolvable for pinned sites
] as const
export type PresenceTemplateStatus = (typeof PRESENCE_TEMPLATE_STATUSES)[number]

// ---------------------------------------------------------------------------
// Template contract
// ---------------------------------------------------------------------------

export interface PresenceTemplateSectionRef {
  kind: PresenceSectionKind
  enabled: boolean
  order: number
}

export interface PresenceTemplate {
  id: string
  family: PresenceTemplateFamily
  name: string
  description: string
  /** Semver-style version string; the registry key is `id@version`. */
  version: string
  status: PresenceTemplateStatus
  /** Ordered sections the template composes (all must exist in the section registry). */
  sections: PresenceTemplateSectionRef[]
  /** Theme keys this template supports (reuses `core/theme.ts` keys, no hex). */
  compatibleThemeKeys: string[]
  /** For vertical-scoped templates (e.g. Finesse/Beauty); `null` when general. */
  verticalKey: string | null
}

// ---------------------------------------------------------------------------
// Initial foundation templates (one placeholder per family)
// ---------------------------------------------------------------------------

function sectionRefs(order: PresenceSectionKind[]): PresenceTemplateSectionRef[] {
  return order.map((kind, i) => ({ kind, enabled: true, order: i }))
}

export const PRESENCE_TEMPLATES: readonly PresenceTemplate[] = [
  {
    id: "sevenef-platform-landing",
    family: "sevenef-platform-landing",
    name: "Sevenef Platform Landing",
    description: "Foundation template for the 7F platform marketing landing.",
    version: "0.1.0",
    status: "foundation",
    sections: sectionRefs(["hero", "services", "faq"]),
    compatibleThemeKeys: ["midnight", "lavender-mist"],
    verticalKey: null,
  },
  {
    id: "finesse-vertical-landing",
    family: "finesse-vertical-landing",
    name: "Finesse Vertical Landing",
    description: "Foundation template for the Finesse (Beauty vertical) landing.",
    version: "0.1.0",
    status: "foundation",
    sections: sectionRefs(["hero", "services", "gallery", "reviews", "faq"]),
    compatibleThemeKeys: ["rose-nude", "sage-luxe", "noir-or"],
    verticalKey: "beauty",
  },
  {
    id: "smart-inbox-product-landing",
    family: "smart-inbox-product-landing",
    name: "Smart Inbox Product Landing",
    description: "Foundation template for the Smart Inbox product landing.",
    version: "0.1.0",
    status: "foundation",
    sections: sectionRefs(["hero", "services", "faq"]),
    compatibleThemeKeys: ["midnight", "lavender-mist"],
    verticalKey: null,
  },
  {
    id: "business-site-standard",
    family: "business-site",
    name: "Business Site — Standard",
    description: "The first functional common template for generated client business websites (the core Presence product). Rendered by the public renderer (PRESENCE-03).",
    version: "0.1.0",
    status: "active",
    sections: sectionRefs([
      "hero",
      "services",
      "gallery",
      "promotions",
      "team",
      "location",
      "whatsapp",
    ]),
    compatibleThemeKeys: ["rose-nude", "sage-luxe", "noir-or", "midnight"],
    verticalKey: null,
  },
]

// ---------------------------------------------------------------------------
// Registry (versioned; key = `id@version`)
// ---------------------------------------------------------------------------

function templateKey(id: string, version: string): string {
  return `${id}@${version}`
}

class PresenceTemplateRegistry {
  private templates = new Map<string, PresenceTemplate>()

  register(tpl: PresenceTemplate): void {
    const key = templateKey(tpl.id, tpl.version)
    if (this.templates.has(key)) {
      throw new Error(`Presence template "${key}" is already registered`)
    }
    // Every referenced section must be a known section kind.
    for (const ref of tpl.sections) {
      if (!(PRESENCE_SECTION_KINDS as readonly string[]).includes(ref.kind)) {
        throw new Error(`Template "${key}" references unknown section "${ref.kind}"`)
      }
    }
    this.templates.set(key, tpl)
  }

  /** Resolve a specific version, or the latest registered version of an id. */
  get(id: string, version?: string): PresenceTemplate | undefined {
    if (version) return this.templates.get(templateKey(id, version))
    const versions = this.getVersions(id)
    return versions.at(-1)
  }

  /** All registered versions of an id, ascending by registration order. */
  getVersions(id: string): PresenceTemplate[] {
    return this.getAll().filter((t) => t.id === id)
  }

  getByFamily(family: PresenceTemplateFamily): PresenceTemplate[] {
    return this.getAll().filter((t) => t.family === family)
  }

  getAll(): PresenceTemplate[] {
    return Array.from(this.templates.values())
  }

  get size(): number {
    return this.templates.size
  }
}

/** Singleton — the single source of truth for Presence templates. */
export const presenceTemplateRegistry = new PresenceTemplateRegistry()

for (const tpl of PRESENCE_TEMPLATES) {
  presenceTemplateRegistry.register(tpl)
}
