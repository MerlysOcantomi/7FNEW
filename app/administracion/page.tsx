/**
 * Workspace Settings page.
 *
 * This page handles workspace configuration: enabling/disabling capabilities,
 * selecting extension packs, and toggling advanced options.
 *
 * It is NOT the Forte Improvements surface. That lives at /forte/improvements
 * and shows domain analysis, gaps, and recommendations powered by DomainState[].
 *
 * When the user arrives from Forte Improvements, the URL carries typed query
 * params (from=forte&domain=X&capability=Y&section=Z). The server component
 * parses them and passes the handoff context to the client component, which
 * renders a contextual banner and highlights the relevant settings item.
 *
 * Navigation:
 *   - "Improvements" in sidebar/search → /forte/improvements
 *   - "Workspace settings" in context bar → /administracion (this page)
 */

import { parseSettingsHandoff } from "@/agents/forte/runtime/business/settings-handoff"
import { AdministracionContent } from "@/components/administracion-content"

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdministracionPage({ searchParams }: PageProps) {
  const params = await searchParams
  const handoff = parseSettingsHandoff(params)

  return <AdministracionContent handoff={handoff} />
}
