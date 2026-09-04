import type { Metadata } from "next"
import { getRequestLocale } from "@core/i18n/server"
import { getFinesseLandingMessages } from "@modules/finesse-web/i18n"
import { FinesseLanding } from "@/components/finesse-web/finesse-landing"

/**
 * `/finesse` — the public Finesse landing (FINESSE-WEB-01, Phase 1).
 *
 * Public by allow-list in `middleware.ts`. Server-rendered from the module
 * catalog only: it never reads a workspace, a session or Presence rows and
 * calls no private API. The locale comes from the request (cookie /
 * Accept-Language via `getRequestLocale`, which tolerates anonymous requests);
 * Spanish is the first market, English the canonical fallback.
 */

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestLocale()
  const t = getFinesseLandingMessages(locale)
  return {
    title: t.meta.title,
    description: t.meta.description,
    openGraph: {
      title: t.meta.ogTitle,
      description: t.meta.ogDescription,
      type: "website",
      siteName: t.brand,
      locale: locale === "es" ? "es_ES" : "en_US",
    },
    robots: { index: true, follow: true },
  }
}

export default async function FinesseLandingPage() {
  const { locale } = await getRequestLocale()
  return <FinesseLanding t={getFinesseLandingMessages(locale)} />
}
