export type SupportedLocale = "en" | "es" | "de"

export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "es", "de"]

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

  common: {
    subject: string
    message: string
    noReply: string
    hi: string
    thankYou: string
    regards: string
  }
}
