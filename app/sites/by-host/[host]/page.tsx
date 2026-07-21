import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { loadPublicSiteByHostname, type PublicSiteResult } from "@engines/presence/public-site"
import { PresenceSiteView } from "@/components/presence/presence-site-view"

/**
 * Public route for a VERIFIED custom domain: `/sites/by-host/<hostname>`.
 *
 * The middleware rewrites an incoming external hostname to this path (only when
 * a canonical app host is configured). A site resolves ONLY through a verified,
 * active custom domain — pending/unknown/disabled hostnames return a neutral 404.
 */

const load = cache((host: string): Promise<PublicSiteResult> =>
  loadPublicSiteByHostname(host, { appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? null }),
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>
}): Promise<Metadata> {
  const { host } = await params
  const result = await load(decodeURIComponent(host))
  if (!result.ok) return { robots: { index: false, follow: false } } // never indexed
  const { seo } = result
  return {
    title: seo.title,
    description: seo.description,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: { index: true, follow: true },
    openGraph: { title: seo.ogTitle, description: seo.ogDescription, type: "website" },
  }
}

export default async function PresenceSiteByHostPage({
  params,
}: {
  params: Promise<{ host: string }>
}) {
  const { host } = await params
  const result = await load(decodeURIComponent(host))
  if (!result.ok) notFound()
  return <PresenceSiteView plan={result.plan} />
}
