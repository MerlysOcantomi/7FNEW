import { LabProtectedShell } from "@/components/lab/lab-protected-shell"

/**
 * `/lab` — Mr Forte Lab catalog placeholder (DEV-PREVIEW-01A/B).
 *
 * Wrapped in `LabProtectedShell`, so it is reachable only with a valid lab
 * access session (level 2); otherwise the shell redirects to `/lab/enter`. The
 * infrastructure gate (level 1) is enforced by `app/lab/layout.tsx` and the
 * middleware. Deliberately inert: no business data, no links into real routes,
 * no session-creating actions. The real catalog and demo workspace arrive in
 * DEV-PREVIEW-01C.
 */

// Reads the access cookie via the shell → never statically prerendered.
export const dynamic = "force-dynamic"

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
            A dedicated space to preview, test and review Sevenef experiments. Everything shown
            here uses fictional data only — never production data.
          </p>
        </header>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">No previews available yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The preview catalog and the demo workspace arrive in the next missions.
          </p>
        </div>
      </section>
    </LabProtectedShell>
  )
}
