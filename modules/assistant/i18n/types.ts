/**
 * Ask Finesse — localized message contract.
 *
 * The Core owns the locale runtime (`SupportedLocale`, `parseLocale`,
 * `useI18n`); this vertical namespace owns every visible string of the global
 * Beauty assistant: launcher, panel chrome, page labels and intros, static
 * page suggestions and the data-aware dynamic suggestion copy. All five
 * official locales ship a COMPLETE catalog against this contract — no
 * `Partial`, no English copies, no empty strings (enforced by tests), the same
 * rules as the Finesse Marketing namespace (P4.MARKETING-5L).
 *
 * Design rules:
 * - Counted prompts are typed functions (`fillGaps(2)` → a full sentence
 *   carrying the number), never `${n} …` concatenations in the engine.
 * - Suggestion IDs are NOT part of this contract — they stay stable across
 *   locales in `finesse-suggestions.ts` so analytics/tests never depend on
 *   language.
 * - `Clienta/Clientas` stays banned (product decision — standard Finesse is
 *   neutral Cliente/Clientes in Spanish).
 */

import type { SupportedLocale } from "@core/i18n/types"
import type { FinesseAssistantPageKey } from "../finesse-assistant"

/** A dynamic suggestion's visible label + the fuller prompt it submits. */
export interface FinesseSuggestionCopy {
  label: string
  prompt: string
}

/** Same, but the submitted prompt interpolates the observed count. */
export interface FinesseCountedSuggestionCopy {
  label: string
  prompt: (count: number) => string
}

/**
 * Copy for every candidate the deterministic suggestion engine can emit
 * (`finesse-suggestions.ts`). Grouped by generator family; the engine maps
 * each candidate id to exactly one entry here.
 */
export interface FinesseDynamicSuggestionMessages {
  overview: {
    firstPeriod: FinesseSuggestionCopy
    earningsDrop: FinesseSuggestionCopy
    earningsGrowth: FinesseSuggestionCopy
    weakRebooking: FinesseSuggestionCopy
    pendingPayments: FinesseSuggestionCopy
    peakAvailability: FinesseSuggestionCopy
  }
  today: {
    fillGaps: FinesseCountedSuggestionCopy
    firstMove: FinesseCountedSuggestionCopy
    summary: FinesseSuggestionCopy
  }
  agenda: {
    fillTomorrow: FinesseCountedSuggestionCopy
    pendingConfirmation: FinesseCountedSuggestionCopy
    cancelledSlot: FinesseSuggestionCopy
    fitUrgent: FinesseSuggestionCopy
  }
  clients: {
    selectedSummary: FinesseSuggestionCopy
    selectedContact: FinesseSuggestionCopy
    overdueRebooking: FinesseCountedSuggestionCopy
  }
  messages: {
    selectedSummary: FinesseSuggestionCopy
    needReply: FinesseCountedSuggestionCopy
  }
  marketing: {
    postLatestWork: FinesseSuggestionCopy
    noMedia: FinesseSuggestionCopy
    reviewReady: FinesseCountedSuggestionCopy
  }
  billing: {
    followUp: FinesseSuggestionCopy
    collectionHealth: FinesseSuggestionCopy
    revenueChange: FinesseSuggestionCopy
  }
}

/**
 * Every visible message of the Ask Finesse assistant, for one locale.
 * Each of the five official catalogs satisfies this contract completely.
 */
export interface FinesseAssistantMessages {
  /** Locale this catalog is written in. */
  locale: SupportedLocale
  /** Launcher label (desktop pill). */
  launcherLabel: string
  /** Accessible name for the icon-only mobile launcher. */
  launcherAria: string
  /** "Finesse" — a proper noun, constant by design. */
  panelTitle: string
  /** Brand line ("beauty intelligence · by Sevenef") — constant by design. */
  panelSubtitle: string
  contextLead: string
  pageLabels: Record<FinesseAssistantPageKey, string>
  intros: Record<FinesseAssistantPageKey, string>
  suggestionsTitle: string
  composerPlaceholder: string
  send: string
  close: string
  thinking: string
  /** Honest state when the AI backend is not configured. */
  unavailable: { title: string; description: string }
  error: { title: string; retry: string }
  /** Honesty note: Finesse advises, it does not execute actions. */
  honestyNote: string
  emptyConversation: string
  /** Static page suggestions — the fallback when no data signal fired. */
  staticSuggestions: Record<FinesseAssistantPageKey, string[]>
  dynamicSuggestions: FinesseDynamicSuggestionMessages
}
