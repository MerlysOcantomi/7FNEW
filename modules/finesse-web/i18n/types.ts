/**
 * Finesse public landing (FINESSE-WEB-01) — localized copy contract.
 *
 * Module-level catalog (same precedent as `modules/overview/i18n`): English is
 * canonical, Spanish is complete and the FIRST market. de/fr/it resolve to
 * English until real catalogs exist. Pure data — the page is a server
 * component that reads no workspace, session or Presence data.
 *
 * Honesty rules baked into the copy (tested in landing.test.ts):
 *   - the brand is "Finesse"; SevenF appears only in the footer credit;
 *   - no testimonials, logos, user counts, ratings, prices or awards;
 *   - no claims about integrations that do not exist (Fresha/Booksy/Treatwell,
 *     agenda import, money recovery); the inbox visual is labeled as an example.
 */

import type { SupportedLocale } from "@core/i18n/types"

export interface FinesseLandingMessages {
  locale: SupportedLocale
  meta: { title: string; description: string; ogTitle: string; ogDescription: string }
  brand: string
  nav: { features: string; forWho: string; cta: string; skipToContent: string; menuLabel: string }
  hero: {
    title: string
    subtitle: string
    cta: string
    secondary: string
    previewCaption: string
  }
  day: {
    eyebrow: string
    title: string
    description: string
    items: Array<{ title: string; description: string }>
  }
  agenda: { eyebrow: string; title: string; description: string; points: string[] }
  messages: {
    eyebrow: string
    title: string
    description: string
    points: string[]
    /** Discreet preview label — the contextual actions are product direction, never a live transport claim. */
    previewLabel: string
  }
  presence: { eyebrow: string; title: string; description: string; points: string[] }
  forWho: { eyebrow: string; title: string; description: string; audiences: string[] }
  why: { title: string; description: string; pillars: string[] }
  /** Primary CTA reuses the existing login (no self-serve signup yet → "Entrar en Finesse"). */
  finalCta: { title: string; description: string; cta: string }
  footer: { login: string; poweredBy: string; tagline: string }
  /** Product previews (illustrative content rendered inside the visuals). */
  preview: {
    today: {
      date: string
      studio: string
      nowTitle: string
      inProgress: string
      time: string
      until: string
      client: string
      service: string
      noteLabel: string
      note: string
      call: string
      viewClient: string
      nextLabel: string
      nextTime: string
      nextClient: string
      viewAgenda: string
      attentionTitle: string
      attention: string[]
      inspirationTitle: string
      inspirationCount: string
      nav: { salon: string; today: string; assistant: string; messages: string; more: string }
    }
    agenda: {
      title: string
      rows: Array<{ time: string; client: string; service: string }>
      free: string
    }
    inbox: {
      name: string
      intent: string
      channel: string
      time: string
      message: string
      viewAppointment: string
      prepareReply: string
      composerPlaceholder: string
    }
    presence: {
      businessName: string
      tagline: string
      servicesLabel: string
      services: string[]
      hoursLabel: string
      hours: string
      locationLabel: string
      location: string
      contactLabel: string
      contact: string
      webLabel: string
    }
  }
}
