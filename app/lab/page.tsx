import Link from "next/link"
import { LabProtectedShell } from "@/components/lab/lab-protected-shell"

/**
 * `/lab` — Mr Forte Lab catalog (DEV-PREVIEW-01C).
 *
 * Wrapped in `LabProtectedShell`, so it is reachable only with a valid lab
 * access session; without it the shell redirects to `/lab/enter`. Once entered,
 * the visitor also holds a normal (demo) Sevenef session, so these links open
 * the REAL Sevenef surfaces on this Lab deployment — no `/lab/*` duplicates.
 * Every surface listed is backed by the provisioned Finesse demo dataset.
 */

// Reads the access cookie via the shell → never statically prerendered.
export const dynamic = "force-dynamic"

const PREVIEWS: { href: string; name: string; description: string }[] = [
  { href: "/today", name: "Today", description: "Daily briefing, appointments and work lanes." },
  { href: "/calendario", name: "Calendar", description: "Salon appointments across the week." },
  { href: "/clientes", name: "Clients", description: "The salon's client book." },
  { href: "/tareas", name: "Tasks", description: "Follow-ups and to-dos." },
  { href: "/inbox", name: "Inbox", description: "Conversations and messages." },
  { href: "/finanzas", name: "Finance", description: "Invoices and revenue." },
  { href: "/business-profile", name: "Business Profile", description: "Salon profile and services." },
]

export default function LabCatalogPage() {
  return (
    <LabProtectedShell>
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Preview environment
          </p>
          <h1 className="text-2xl font-semibold">Mr Forte Lab</h1>
          <p className="text-sm text-muted-foreground">
            Explore Sevenef with the Finesse demo salon. Everything here is fictional data in an
            isolated demo workspace — never production.
          </p>
        </header>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PREVIEWS.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Demo data ready
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </LabProtectedShell>
  )
}
