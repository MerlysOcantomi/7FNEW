/**
 * Sevenef Presence — section registry (FOUNDATION).
 *
 * An EXTENSIBLE registry of the sections a Presence site can be built from. This
 * is the contract + registry that lets us add visual variants later WITHOUT a
 * redesign — mirroring `core/registry/module-registry.ts` (singleton class,
 * duplicate-id throw, `get`/`getAll` queries).
 *
 * Design rules honored:
 *   - Pure and DB-free (safe on client/server/tests).
 *   - Each section DECLARES which Business Profile fields it consumes
 *     (`businessProfileSources`). This is how we enforce "do not duplicate
 *     public data" — the section reads from the profile, it never owns a copy.
 *   - No visual variant is designed here yet; only the extensible contract.
 */

// ---------------------------------------------------------------------------
// Section kinds & data-source contract
// ---------------------------------------------------------------------------

/** The initial set of section kinds. Extend by registering a new definition. */
export const PRESENCE_SECTION_KINDS = [
  "hero",
  "services",
  "gallery",
  "reviews",
  "team",
  "booking",
  "whatsapp",
  "location",
  "faq",
  "promotions",
] as const
export type PresenceSectionKind = (typeof PRESENCE_SECTION_KINDS)[number]

/**
 * Canonical Business Profile field groups a section can read from. These name
 * WHAT the section needs; the actual data lives in the Business Profile
 * (`Workspace.config.businessProfile` + `serviceCatalog` + `ChannelConnection`),
 * never in Presence. See `content-source.ts` for the read-only projection.
 */
export const PRESENCE_PROFILE_SOURCES = [
  "identity", // business name, description
  "services", // service catalog
  "prices", // per-service prices (future profile extension)
  "hours", // opening hours / schedule
  "location", // address / geo
  "team", // staff / specialists
  "phone", // phone number
  "whatsapp", // WhatsApp channel
  "social", // social networks
  "promotions", // active promotions
  "photos", // media library (PresenceMedia)
  "reviews", // testimonials / ratings (future profile extension)
] as const
export type PresenceProfileSource = (typeof PRESENCE_PROFILE_SOURCES)[number]

export interface PresenceSectionDefinition {
  kind: PresenceSectionKind
  /** English technical label (product labels are not translated in-repo). */
  label: string
  description: string
  /** Business Profile field groups this section renders from. */
  businessProfileSources: PresenceProfileSource[]
  /** Whether the section is enabled by default when a site is created. */
  defaultEnabled: boolean
  /** Whether more than one instance may appear on a page. */
  repeatable: boolean
  /**
   * Section contract version. Bumped when the data contract of the section
   * changes (independent from template versions).
   */
  version: string
}

// ---------------------------------------------------------------------------
// Initial section definitions
// ---------------------------------------------------------------------------

export const PRESENCE_SECTION_DEFINITIONS: readonly PresenceSectionDefinition[] = [
  {
    kind: "hero",
    label: "Hero",
    description: "Primary above-the-fold identity block with headline and primary call to action.",
    businessProfileSources: ["identity", "photos", "promotions"],
    defaultEnabled: true,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "services",
    label: "Services",
    description: "List of offered services, optionally with prices, from the service catalog.",
    businessProfileSources: ["services", "prices"],
    defaultEnabled: true,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "gallery",
    label: "Gallery",
    description: "Curated grid of real work photos. Integrity of work samples is preserved.",
    businessProfileSources: ["photos"],
    defaultEnabled: true,
    repeatable: true,
    version: "1.0.0",
  },
  {
    kind: "reviews",
    label: "Reviews",
    description: "Client testimonials and ratings.",
    businessProfileSources: ["reviews"],
    defaultEnabled: false,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "team",
    label: "Team",
    description: "The people/specialists behind the business.",
    businessProfileSources: ["team", "photos"],
    defaultEnabled: false,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "booking",
    label: "Booking",
    description: "Entry point to book/reserve. Wires to the workspace booking surface when available.",
    businessProfileSources: ["services", "hours"],
    defaultEnabled: false,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "whatsapp",
    label: "WhatsApp",
    description: "Direct WhatsApp contact action, sourced from the workspace WhatsApp channel.",
    businessProfileSources: ["whatsapp", "phone"],
    defaultEnabled: true,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "location",
    label: "Location",
    description: "Address, map and directions.",
    businessProfileSources: ["location", "hours"],
    defaultEnabled: true,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "faq",
    label: "FAQ",
    description: "Frequently asked questions.",
    businessProfileSources: ["identity"],
    defaultEnabled: false,
    repeatable: false,
    version: "1.0.0",
  },
  {
    kind: "promotions",
    label: "Promotions",
    description: "Active promotions and offers.",
    businessProfileSources: ["promotions"],
    defaultEnabled: false,
    repeatable: true,
    version: "1.0.0",
  },
]

// ---------------------------------------------------------------------------
// Registry (mirrors core/registry/module-registry.ts conventions)
// ---------------------------------------------------------------------------

class PresenceSectionRegistry {
  private sections = new Map<PresenceSectionKind, PresenceSectionDefinition>()

  register(def: PresenceSectionDefinition): void {
    if (this.sections.has(def.kind)) {
      throw new Error(`Presence section "${def.kind}" is already registered`)
    }
    this.sections.set(def.kind, def)
  }

  get(kind: PresenceSectionKind): PresenceSectionDefinition | undefined {
    return this.sections.get(kind)
  }

  has(kind: PresenceSectionKind): boolean {
    return this.sections.has(kind)
  }

  getAll(): PresenceSectionDefinition[] {
    return Array.from(this.sections.values())
  }

  /** Default page composition: enabled-by-default sections in declared order. */
  getDefaultKinds(): PresenceSectionKind[] {
    return this.getAll()
      .filter((s) => s.defaultEnabled)
      .map((s) => s.kind)
  }

  get size(): number {
    return this.sections.size
  }
}

/** Singleton — the single source of truth for Presence sections. */
export const presenceSectionRegistry = new PresenceSectionRegistry()

for (const def of PRESENCE_SECTION_DEFINITIONS) {
  presenceSectionRegistry.register(def)
}
