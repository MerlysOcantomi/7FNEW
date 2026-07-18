/**
 * The five official 7F locales — the single canonical registry (P4.CORE-5L).
 * Order is the canonical presentation order used by language pickers.
 * es/en carry the most complete catalogs today; de/fr/it are OFFICIAL and
 * accepted by the runtime, controls and APIs, with an explicit, honest
 * English fallback per catalog until real reviewed translations land.
 */
export type SupportedLocale = "es" | "en" | "de" | "fr" | "it"

export const SUPPORTED_LOCALES: SupportedLocale[] = ["es", "en", "de", "fr", "it"]

/** Locale whose catalogs back every explicit fallback. Never remove its content. */
export const FALLBACK_LOCALE: SupportedLocale = "en"

/**
 * Rich per-locale definition — the Core locale registry (§5, P4.CORE-5L).
 * Presentation order in pickers = SUPPORTED_LOCALES order above.
 */
export interface LocaleDefinition {
  code: SupportedLocale
  /** Native proper noun — NEVER translated by the active locale. */
  nativeName: string
  /** All five launch locales are ltr; the contract keeps direction for future locales. */
  direction: "ltr" | "rtl"
  /**
   * Default REGIONAL locale for Intl formatting (dates/numbers/currency).
   * A FORMAT default only — never a persisted UI code. Regional variants
   * (es-MX, de-CH, fr-CH, it-CH, en-US…) share the base catalog but may
   * format differently; formatters accept them verbatim.
   */
  intlLocale: string
  /** Catalog fallback locale; null marks the terminal fallback (en). */
  fallback: SupportedLocale | null
}

export const LOCALE_REGISTRY: Record<SupportedLocale, LocaleDefinition> = {
  es: { code: "es", nativeName: "Español", direction: "ltr", intlLocale: "es-ES", fallback: "en" },
  en: { code: "en", nativeName: "English", direction: "ltr", intlLocale: "en-GB", fallback: null },
  de: { code: "de", nativeName: "Deutsch", direction: "ltr", intlLocale: "de-DE", fallback: "en" },
  fr: { code: "fr", nativeName: "Français", direction: "ltr", intlLocale: "fr-FR", fallback: "en" },
  it: { code: "it", nativeName: "Italiano", direction: "ltr", intlLocale: "it-IT", fallback: "en" },
}

export const DEFAULT_LOCALE: SupportedLocale = "en"

export interface TranslationSet {
  locale: SupportedLocale
  label: string

  email: {
    ack: {
      heading: string
      body: string
      subjectLabel: string
      greeting: (name?: string | null) => string
    }
    outbound: {
      footer: (workspaceName: string) => string
      defaultSubject: string
    }
    poweredBy: string
    sentVia: string
  }

  activity: {
    created: string
    updated: string
    deleted: string
    status_change: string
    assigned: string
    unassigned: string
    comment: string
    mention: string
    email_sent: string
    email_failed: string
    email_skipped: string
  }

  notifications: {
    inbox: {
      newConversation: (who: string) => string
      newConversationFallback: string
      newMessage: (who: string) => string
      newMessageFallback: string
      assigned: string
      assignedFallback: string
      contactWebChat: string
      contactEmail: string
      contactDefault: string
    }
  }

  common: {
    subject: string
    message: string
    noReply: string
    hi: string
    thankYou: string
    regards: string
  }
}
