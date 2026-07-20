/**
 * Sevenef Presence — Freya provider contracts + default heuristic provider
 * (FOUNDATION).
 *
 * Freya is the transversal creative agent (Mr Forte Lab). For Presence she does
 * two things: propose site STYLES from the Business Profile (the client picks
 * one, the site publishes), and ASSESS photos (select the appropriate ones and
 * declare the technical variants to generate).
 *
 * Guardrails honored here:
 *   - No mandatory AI-provider dependency: capabilities are behind INTERCHANGE-
 *     ABLE provider interfaces. The DEFAULT provider is deterministic and uses
 *     NO AI vendor — real logic, not a fake demo, and clearly labeled
 *     `generatedBy: "heuristic"`.
 *   - Real work photos must never be edited in a way that FALSIFIES the
 *     professional result: `FreyaMediaAssessment.preserveIntegrity` is always
 *     `true` for real work samples and variants are limited to crop/resize/
 *     format (no retouch/enhance).
 *   - Pure and DB-free; `nowIso` is injected so the providers stay deterministic
 *     and testable (no clock, no randomness).
 */

import type { PresenceContentSource } from "./content-source"
import type { PresenceMedia } from "./types"
import { isPresenceThemeKey } from "./themes"

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface FreyaSiteProposal {
  id: string
  workspaceId: string
  /** Stable style identifier within the proposal set (e.g. "signature"). */
  styleKey: string
  /** Human-facing style name. */
  name: string
  themeKey: string
  templateFamily: string
  templateId: string
  /** Short reason this style fits the business — advisory. */
  rationale: string
  /** How this proposal was produced: the default engine tags itself "heuristic". */
  generatedBy: string
  createdAt: string
}

/** A technical variant to derive from a source photo (crop/resize/format only). */
export interface FreyaMediaVariantSpec {
  label: string
  width: number
  height: number
  format: "webp" | "jpeg"
}

export const FREYA_MEDIA_VERDICTS = ["use", "review", "reject"] as const
export type FreyaMediaVerdict = (typeof FREYA_MEDIA_VERDICTS)[number]

export interface FreyaMediaAssessment {
  id: string
  mediaId: string
  workspaceId: string
  verdict: FreyaMediaVerdict
  /** Suggested editorial role on the site. */
  roleSuggestion: PresenceMedia["role"]
  /** Echoes whether the source is a real professional result. */
  isRealWorkSample: boolean
  /**
   * Always `true` for real work samples: variants must preserve the real
   * professional outcome (no retouch/enhancement that changes the result).
   */
  preserveIntegrity: boolean
  /** Technical variants to generate (crop/resize/format only). */
  variants: FreyaMediaVariantSpec[]
  notes: string
  assessedBy: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Provider interfaces (interchangeable — AI providers plug in later)
// ---------------------------------------------------------------------------

export interface FreyaStyleProviderInput {
  workspaceId: string
  verticalKey: string | null
  content: PresenceContentSource
  /** Injected ISO timestamp — keeps providers pure/deterministic. */
  nowIso: string
}

export interface FreyaMediaProviderInput {
  media: PresenceMedia
  nowIso: string
}

export interface FreyaStyleProvider {
  readonly id: string
  /** Prepare exactly three style proposals for the client to choose from. */
  proposeStyles(input: FreyaStyleProviderInput): Promise<FreyaSiteProposal[]>
}

export interface FreyaMediaProvider {
  readonly id: string
  assessMedia(input: FreyaMediaProviderInput): Promise<FreyaMediaAssessment>
}

// ---------------------------------------------------------------------------
// Default heuristic style provider (no AI vendor)
// ---------------------------------------------------------------------------

interface StylePreset {
  styleKey: string
  name: string
  themeKey: string
  rationale: string
}

/** Theme families are ordered by fit; the first is the recommended default. */
const BEAUTY_STYLE_ORDER: StylePreset[] = [
  { styleKey: "signature", name: "Signature", themeKey: "rose-nude", rationale: "Warm, premium beauty look — the default for the vertical." },
  { styleKey: "serene", name: "Serene", themeKey: "sage-luxe", rationale: "Calm wellness/spa feel." },
  { styleKey: "atelier", name: "Atelier", themeKey: "noir-or", rationale: "Luxury, high-contrast glam." },
]

const DEFAULT_STYLE_ORDER: StylePreset[] = [
  { styleKey: "clean", name: "Clean", themeKey: "midnight", rationale: "Neutral premium, works for most services." },
  { styleKey: "soft", name: "Soft", themeKey: "lavender-mist", rationale: "Modern, approachable service brand." },
  { styleKey: "warm", name: "Warm", themeKey: "rose-nude", rationale: "Warmer, personable variant." },
]

const BEAUTY_VERTICALS = new Set([
  "beauty",
  "salon",
  "nails",
  "barber",
  "spa",
  "lashes",
  "estetica",
])

function pickStyleOrder(verticalKey: string | null): StylePreset[] {
  if (verticalKey && BEAUTY_VERTICALS.has(verticalKey.toLowerCase())) return BEAUTY_STYLE_ORDER
  return DEFAULT_STYLE_ORDER
}

/**
 * The default, deterministic Freya style engine. Produces exactly three
 * proposals from the business vertical + content — no AI vendor involved.
 */
export class HeuristicFreyaStyleProvider implements FreyaStyleProvider {
  readonly id = "heuristic"

  async proposeStyles(input: FreyaStyleProviderInput): Promise<FreyaSiteProposal[]> {
    const isBeauty =
      !!input.verticalKey && BEAUTY_VERTICALS.has(input.verticalKey.toLowerCase())
    const templateId = isBeauty ? "finesse-vertical-landing" : "business-site-standard"
    const templateFamily = isBeauty ? "finesse-vertical-landing" : "business-site"

    return pickStyleOrder(input.verticalKey).map((preset) => {
      // Defensive: only ever emit valid, existing theme keys.
      const themeKey = isPresenceThemeKey(preset.themeKey) ? preset.themeKey : "midnight"
      return {
        id: `${input.workspaceId}:${preset.styleKey}`,
        workspaceId: input.workspaceId,
        styleKey: preset.styleKey,
        name: preset.name,
        themeKey,
        templateFamily,
        templateId,
        rationale: preset.rationale,
        generatedBy: this.id,
        createdAt: input.nowIso,
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Default heuristic media provider (no AI vendor, integrity-preserving)
// ---------------------------------------------------------------------------

/** Standard delivery widths. Never upscale beyond the source width. */
const VARIANT_WIDTHS: Array<{ label: string; width: number }> = [
  { label: "thumb", width: 400 },
  { label: "card", width: 800 },
  { label: "hero", width: 1600 },
]

function buildVariants(media: PresenceMedia): FreyaMediaVariantSpec[] {
  const { width, height } = media
  // Without source dimensions we cannot safely compute variants.
  if (!width || !height) return []
  const aspect = height / width
  return VARIANT_WIDTHS.filter((v) => v.width <= width).map((v) => ({
    label: v.label,
    width: v.width,
    height: Math.round(v.width * aspect),
    format: "webp" as const,
  }))
}

export class HeuristicFreyaMediaProvider implements FreyaMediaProvider {
  readonly id = "heuristic"

  async assessMedia(input: FreyaMediaProviderInput): Promise<FreyaMediaAssessment> {
    const { media } = input
    const hasDimensions = !!media.width && !!media.height
    const variants = buildVariants(media)

    // Fails safe: no dimensions → send to manual review rather than guess.
    const verdict: FreyaMediaVerdict = hasDimensions ? "use" : "review"

    const notes = media.isRealWorkSample
      ? "Real work sample: variants limited to crop/resize/format — professional result must not be altered."
      : hasDimensions
        ? "Standard asset: technical variants generated."
        : "Missing dimensions: manual review required before publishing."

    return {
      id: `${media.id}:assessment`,
      mediaId: media.id,
      workspaceId: media.workspaceId,
      verdict,
      roleSuggestion: media.role,
      isRealWorkSample: media.isRealWorkSample,
      // Integrity is ALWAYS preserved for real work samples.
      preserveIntegrity: media.isRealWorkSample ? true : false,
      variants,
      notes,
      assessedBy: this.id,
      createdAt: input.nowIso,
    }
  }
}

// ---------------------------------------------------------------------------
// Provider resolution (default = heuristic; override to swap in an AI provider)
// ---------------------------------------------------------------------------

const defaultStyleProvider = new HeuristicFreyaStyleProvider()
const defaultMediaProvider = new HeuristicFreyaMediaProvider()

export function resolveFreyaStyleProvider(
  override?: FreyaStyleProvider | null,
): FreyaStyleProvider {
  return override ?? defaultStyleProvider
}

export function resolveFreyaMediaProvider(
  override?: FreyaMediaProvider | null,
): FreyaMediaProvider {
  return override ?? defaultMediaProvider
}
