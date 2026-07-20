import { requireLabAvailability } from "@core/lab/gate"

/**
 * `/lab` — Mr Forte Lab catalog placeholder (DEV-PREVIEW-01A).
 *
 * The middleware already 404s denied requests at the edge; the page re-checks
 * the gate (like the layout) so no lab content can ever render or stream if
 * the edge layer is bypassed. Deliberately inert: no business data, no links
 * into real routes, no session-creating actions. The access flow and the real
 * preview catalog arrive in DEV-PREVIEW-01B/C.
 */
export default async function LabCatalogPage() {
  await requireLabAvailability()
  return (
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
          Access infrastructure is not configured yet. The preview catalog, Lab access and the
          demo workspace arrive in the next missions.
        </p>
      </div>
    </section>
  )
}
