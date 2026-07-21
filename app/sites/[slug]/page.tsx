import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { loadPublicSiteBySlug, type PublicSiteResult } from "@engines/presence/public-site"
import { PresenceSiteView } from "@/components/presence/presence-site-view"

/**
 * Public route for a Sevenef-managed Presence site: `/sites/<slug>`.
 *
 * Resolves the site by normalized slug, enforces effective visibility
 * (published + public + entitled), and renders the registered template with
 * content from the Business Profile. Anything that should not be shown —
 * missing, draft, offline, suspended, no entitlement, invalid template —
 * returns a neutral 404 with NO internal details.
 */

function ctx() {
  return { appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? null }
}

// Dedupe the load between generateMetadata and the page render (per request).
const load = cache((slug: string): Promise<PublicSiteResult> => loadPublicSiteBySlug(slug, ctx()))

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const result = await load(slug)
  if (!result.ok) {
    // Drafts / offline / suspended / missing / invalid-template are never
    // indexed. The page renders the neutral not-found boundary (see the default
    // export). Next 16 serves on-demand dynamic not-found as a soft-404 (HTTP
    // 200 body); the noindex robots directive is what keeps them out of search.
    return { robots: { index: false, follow: false } }
  }
  const { seo } = result
  return {
    title: seo.title,
    description: seo.description,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: { index: true, follow: true },
    openGraph: { title: seo.ogTitle, description: seo.ogDescription, type: "website" },
  }
}

export default async function PresenceSitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await load(slug)
  if (!result.ok) notFound()
  return <PresenceSiteView plan={result.plan} />
}
