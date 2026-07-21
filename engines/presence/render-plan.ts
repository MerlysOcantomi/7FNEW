/**
 * Sevenef Presence — render plan (PRESENCE-03).
 *
 * Pure, DB-free, framework-free logic that turns a resolved site + template +
 * content + media + visual config into a STRUCTURED render plan. The React
 * renderer (`components/presence/*`) consumes this plan; it never reads raw
 * config or business data itself. This keeps content vs presentation separated
 * and makes the whole composition unit-testable without a DOM.
 *
 * Rules honored:
 *   - Only sections that are (a) registered, (b) enabled, and (c) have valid
 *     content are included. Empty sections are dropped cleanly.
 *   - Unknown section kinds / unknown visual-config keys are ignored safely.
 *   - No business content is invented — every value comes from the content
 *     source (Business Profile) or approved media.
 *   - No Beauty/vertical-specific logic here (common template only).
 */

import type { PresenceContentSource } from "./content-source"
import { presenceSectionRegistry, type PresenceSectionKind } from "./sections"
import { presenceTemplateRegistry, type PresenceTemplate } from "./templates"
import { isPresenceThemeKey } from "./themes"

// ---------------------------------------------------------------------------
// Media (subset the renderer needs — mirrors PresenceMedia rows)
// ---------------------------------------------------------------------------

export interface RenderMedia {
  id: string
  kind: string
  purpose: string
  url: string
  width: number | null
  height: number | null
  reviewStatus: string
  isRealWorkSample: boolean
  preserveIntegrity: boolean
  sourceMediaId: string | null
}

/** Media is usable on a public page only once Freya's review verdict is "use". */
export function isApprovedMedia(m: RenderMedia): boolean {
  return m.reviewStatus === "use"
}

// ---------------------------------------------------------------------------
// Planned sections (discriminated union consumed by the React renderer)
// ---------------------------------------------------------------------------

export interface PlannedImage {
  url: string
  alt: string
  width: number | null
  height: number | null
  isRealWorkSample: boolean
}

export type PlannedSection =
  | { kind: "hero"; data: { title: string; subtitle: string | null; background: PlannedImage | null; cta: PlannedCta | null } }
  | { kind: "services"; data: { items: Array<{ name: string; category: string | null }> } }
  | { kind: "gallery"; data: { images: PlannedImage[] } }
  | { kind: "location"; data: { region: string | null; hours: string | null } }
  | { kind: "whatsapp"; data: { href: string; display: string } }

export interface PlannedCta {
  label: string
  href: string
}

export interface PlannedNavItem {
  label: string
  href: string // in-page anchor, e.g. "#services"
}

export interface PresenceRenderPlan {
  siteId: string
  templateId: string
  templateVersion: string
  themeKey: string
  siteName: string
  tagline: string | null
  nav: PlannedNavItem[]
  primaryCta: PlannedCta | null
  sections: PlannedSection[]
  /** Sanitized presentation hints (unknown keys already stripped upstream). */
  presentation: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface BuildRenderPlanInput {
  site: {
    id: string
    templateId: string
    templateVersion: string
    themeKey: string
    visualConfig: string | null
  }
  content: PresenceContentSource
  media: RenderMedia[]
}

export class PresenceTemplateNotFoundError extends Error {
  constructor(public templateId: string, public version: string) {
    super(`Presence template not found: ${templateId}@${version}`)
    this.name = "PresenceTemplateNotFoundError"
  }
}

// ---------------------------------------------------------------------------
// Visual config parsing (safe)
// ---------------------------------------------------------------------------

interface ParsedVisualConfig {
  sectionOverrides: Map<PresenceSectionKind, { enabled?: boolean; order?: number }>
  presentation: Record<string, unknown>
}

function parseVisualConfig(raw: string | null): ParsedVisualConfig {
  const empty: ParsedVisualConfig = { sectionOverrides: new Map(), presentation: {} }
  if (!raw) return empty
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty // invalid JSON → ignored safely
  }
  if (!parsed || typeof parsed !== "object") return empty

  const obj = parsed as Record<string, unknown>
  const overrides = new Map<PresenceSectionKind, { enabled?: boolean; order?: number }>()
  if (Array.isArray(obj.sections)) {
    for (const entry of obj.sections) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      const kind = e.kind
      // Ignore unknown / non-registered section kinds safely.
      if (typeof kind !== "string" || !presenceSectionRegistry.has(kind as PresenceSectionKind)) continue
      overrides.set(kind as PresenceSectionKind, {
        enabled: typeof e.enabled === "boolean" ? e.enabled : undefined,
        order: typeof e.order === "number" ? e.order : undefined,
      })
    }
  }
  const presentation =
    obj.presentation && typeof obj.presentation === "object"
      ? (obj.presentation as Record<string, unknown>)
      : {}
  return { sectionOverrides: overrides, presentation }
}

// ---------------------------------------------------------------------------
// Content → section data (each returns null when there is no valid content)
// ---------------------------------------------------------------------------

function toWaHref(whatsapp: string): { href: string; display: string } | null {
  const digits = whatsapp.replace(/[^\d]/g, "")
  if (digits.length < 6) return null
  return { href: `https://wa.me/${digits}`, display: whatsapp.trim() }
}

function pickGalleryImages(media: RenderMedia[]): PlannedImage[] {
  return media
    .filter((m) => isApprovedMedia(m))
    .filter((m) => m.kind === "photo" || m.kind === "variant")
    .filter((m) => m.purpose === "gallery" || m.purpose === "work_sample")
    .map((m) => ({
      url: m.url,
      alt: m.isRealWorkSample ? "Work sample" : "Gallery image",
      width: m.width,
      height: m.height,
      isRealWorkSample: m.isRealWorkSample,
    }))
}

function pickHeroBackground(media: RenderMedia[]): PlannedImage | null {
  const hero = media.find(
    (m) => isApprovedMedia(m) && m.purpose === "hero" && (m.kind === "photo" || m.kind === "variant"),
  )
  if (!hero) return null
  return {
    url: hero.url,
    alt: "",
    width: hero.width,
    height: hero.height,
    isRealWorkSample: hero.isRealWorkSample,
  }
}

function buildSectionData(
  kind: PresenceSectionKind,
  content: PresenceContentSource,
  media: RenderMedia[],
  primaryCta: PlannedCta | null,
): PlannedSection | null {
  switch (kind) {
    case "hero":
      return {
        kind: "hero",
        data: {
          title: content.identity.name,
          subtitle: content.identity.description,
          background: pickHeroBackground(media),
          cta: primaryCta,
        },
      }
    case "services": {
      const items = content.services
        .filter((s) => s.active)
        .map((s) => ({ name: s.name, category: s.category }))
      return items.length > 0 ? { kind: "services", data: { items } } : null
    }
    case "gallery": {
      const images = pickGalleryImages(media)
      return images.length > 0 ? { kind: "gallery", data: { images } } : null
    }
    case "location": {
      if (!content.region && !content.hours) return null
      return { kind: "location", data: { region: content.region, hours: content.hours } }
    }
    case "whatsapp": {
      if (!content.channels.whatsapp) return null
      const wa = toWaHref(content.channels.whatsapp)
      return wa ? { kind: "whatsapp", data: wa } : null
    }
    // promotions / team / reviews / booking / faq: no content model yet → omitted.
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<string, string> = {
  services: "Services",
  gallery: "Gallery",
  location: "Location",
  whatsapp: "Contact",
}

/**
 * Build the render plan. Throws `PresenceTemplateNotFoundError` when the pinned
 * template/version is not registered (the route maps that to a safe error page).
 */
export function buildRenderPlan(input: BuildRenderPlanInput): PresenceRenderPlan {
  const { site, content, media } = input
  const template: PresenceTemplate | undefined = presenceTemplateRegistry.get(
    site.templateId,
    site.templateVersion,
  )
  if (!template) {
    throw new PresenceTemplateNotFoundError(site.templateId, site.templateVersion)
  }

  const themeKey = isPresenceThemeKey(site.themeKey) ? site.themeKey : "midnight"
  const { sectionOverrides, presentation } = parseVisualConfig(site.visualConfig)

  // Primary CTA: WhatsApp when available (a real, working contact action).
  const primaryCta: PlannedCta | null = content.channels.whatsapp
    ? (() => {
        const wa = toWaHref(content.channels.whatsapp!)
        return wa ? { label: "Message on WhatsApp", href: wa.href } : null
      })()
    : null

  // Resolve the effective, ordered list of section kinds from the template +
  // safe overrides. Unknown kinds are already excluded by the registry check.
  const planned = template.sections
    .map((ref) => {
      const override = sectionOverrides.get(ref.kind)
      return {
        kind: ref.kind,
        enabled: override?.enabled ?? ref.enabled,
        order: override?.order ?? ref.order,
      }
    })
    .filter((s) => s.enabled && presenceSectionRegistry.has(s.kind))
    .sort((a, b) => a.order - b.order)

  const sections: PlannedSection[] = []
  for (const s of planned) {
    const built = buildSectionData(s.kind, content, media, primaryCta)
    if (built) sections.push(built)
  }

  const nav: PlannedNavItem[] = sections
    .filter((s) => s.kind !== "hero" && SECTION_LABELS[s.kind])
    .map((s) => ({ label: SECTION_LABELS[s.kind], href: `#${s.kind}` }))

  return {
    siteId: site.id,
    templateId: template.id,
    templateVersion: template.version,
    themeKey,
    siteName: content.identity.name,
    tagline: content.identity.description,
    nav,
    primaryCta,
    sections,
    presentation,
  }
}
