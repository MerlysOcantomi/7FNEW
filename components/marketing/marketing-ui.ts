/**
 * Shared visual vocabulary for the Finesse Marketing surface.
 *
 * Status → semantic-token chip tones and demo image placeholder gradients.
 * COLORS: theme tokens only (no parallel palette) — everything here takes the
 * Rose Nude skin for free under `data-theme="rose-nude"`, exactly like the
 * Beauty "Hoy" surfaces. States never rely on color alone: every chip renders
 * its text label next to the tone.
 */

import type { CSSProperties } from "react"
import type {
  CampaignStatus,
  PlaceholderTone,
  PostStatus,
  WorkStatus,
} from "@modules/marketing/types"

export type ChipTone = "accent" | "info" | "success" | "lead" | "neutral" | "urgency"

const TONE_STYLE: Record<ChipTone, CSSProperties> = {
  accent: {
    background: "var(--accent-muted)",
    color: "var(--accent-on-dark)",
    borderColor: "var(--accent-muted-border)",
  },
  info: {
    background: "var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 12%, transparent))",
    color: "var(--inbox-info)",
    borderColor: "color-mix(in srgb, var(--inbox-info) 32%, transparent)",
  },
  success: {
    background: "var(--inbox-success-soft, color-mix(in srgb, var(--inbox-success) 12%, transparent))",
    color: "var(--inbox-success)",
    borderColor: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
  },
  lead: {
    background: "var(--inbox-lead-soft, color-mix(in srgb, var(--inbox-lead) 12%, transparent))",
    color: "var(--inbox-lead)",
    borderColor: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)",
  },
  neutral: {
    background: "var(--app-surface-subtle)",
    color: "var(--text-secondary-light)",
    borderColor: "var(--border-dark)",
  },
  urgency: {
    background: "var(--inbox-urgency-soft, color-mix(in srgb, var(--inbox-urgency) 12%, transparent))",
    color: "var(--inbox-urgency)",
    borderColor: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
  },
}

export function chipStyle(tone: ChipTone): CSSProperties {
  return TONE_STYLE[tone]
}

/** Shared chip classes — tones supply colors, this supplies shape. */
export const CHIP_CLASS =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"

export const WORK_STATUS_TONE: Record<WorkStatus, ChipTone> = {
  nuevo: "info",
  sin_usar: "neutral",
  preparado: "accent",
  programado: "info",
  publicado: "success",
}

export const POST_STATUS_TONE: Record<PostStatus, ChipTone> = {
  borrador: "neutral",
  preparada: "accent",
  aprobada: "lead",
  programada: "info",
  publicada: "success",
}

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, ChipTone> = {
  sugerida: "lead",
  aprobada: "info",
  programada: "info",
  activa: "success",
  pausada: "neutral",
  finalizada: "neutral",
}

/**
 * Demo/placeholder thumbnail gradients — token-derived (no hardcoded photo
 * URLs, no fixed hex), so placeholders stay coherent in every theme.
 */
export const PLACEHOLDER_GRADIENTS: Record<PlaceholderTone, string> = {
  rose: "linear-gradient(150deg, var(--accent-soft), var(--accent-primary) 85%)",
  gold: "linear-gradient(150deg, color-mix(in srgb, var(--inbox-lead) 18%, var(--app-surface-dark-elevated)), color-mix(in srgb, var(--inbox-lead) 72%, var(--app-surface-dark)))",
  red: "linear-gradient(150deg, color-mix(in srgb, var(--inbox-urgency) 18%, var(--app-surface-dark-elevated)), color-mix(in srgb, var(--inbox-urgency) 68%, var(--app-surface-dark)))",
  blush: "linear-gradient(150deg, var(--accent-soft), color-mix(in srgb, var(--accent-primary) 45%, var(--app-surface-dark-elevated)))",
  lilac: "linear-gradient(150deg, color-mix(in srgb, var(--inbox-info) 14%, var(--app-surface-dark-elevated)), color-mix(in srgb, var(--inbox-info) 55%, var(--accent-primary)))",
  sage: "linear-gradient(150deg, color-mix(in srgb, var(--inbox-success) 14%, var(--app-surface-dark-elevated)), color-mix(in srgb, var(--inbox-success) 60%, var(--app-surface-dark)))",
}

export function placeholderBackground(tone: PlaceholderTone | undefined): string {
  return PLACEHOLDER_GRADIENTS[tone ?? "rose"]
}

/** Shared card shell classes (mirrors the Beauty "Hoy" card family). */
export const CARD_CLASS =
  "rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"

/** Primary / secondary / soft button class families with focus states. */
export const BTN_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"

export const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

export const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-secondary-light)] transition-colors hover:bg-[var(--app-surface-hover)] hover:text-[var(--text-primary-light)] disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

export const BTN_SOFT = `inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${BTN_FOCUS}`

export const BTN_SOFT_STYLE: CSSProperties = {
  background: "var(--accent-muted)",
  color: "var(--accent-on-dark)",
  borderColor: "var(--accent-muted-border)",
}

/** Shared input classes for the Marketing dialogs. */
export const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-2 text-sm text-[var(--text-primary-light)] outline-none placeholder:text-[var(--text-tertiary-light)] focus:ring-2 focus:ring-[var(--accent-primary)]/40"

export const LABEL_CLASS = "text-[11px] font-semibold text-[var(--text-secondary-light)]"
