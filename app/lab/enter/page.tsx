import { redirect } from "next/navigation"
import { getLabAccessSession } from "@core/lab/access-session"
import { EnterForm } from "./enter-form"

/**
 * `/lab/enter` — access-key entry (DEV-PREVIEW-01B).
 *
 * Reachable when the infrastructure gate (level 1) allows the request but no
 * access session (level 2) exists yet. When a valid session already exists it
 * redirects to `/lab`. The UI is intentionally sober and leaks NOTHING about
 * configuration (no project id, host list, missing vars, hashes or traces).
 */

// Reads the access cookie → never statically prerendered.
export const dynamic = "force-dynamic"

export default async function LabEnterPage() {
  const session = await getLabAccessSession()
  if (session) redirect("/lab")

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <header className="space-y-1 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Restricted preview environment
        </p>
        <h1 className="text-2xl font-semibold">Mr Forte Lab</h1>
      </header>
      <EnterForm />
      <p className="text-center text-xs text-muted-foreground">Fictional data only.</p>
    </section>
  )
}
