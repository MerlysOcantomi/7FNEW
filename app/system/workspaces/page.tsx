import Link from "next/link"
import { Building2 } from "lucide-react"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listWorkspacesForSystem, type SystemWorkspaceSummary } from "@core/system/workspaces"

/**
 * Read-only directory of every tenant in the platform.
 *
 * Server component. We call the data accessor directly (`listWorkspacesForSystem`)
 * instead of `fetch`-ing our own `/api/system/workspaces` route because:
 *   - Server-to-self HTTP fetches require absolute URL juggling and double the
 *     work (extra request + extra middleware pass) for no benefit.
 *   - The accessor is the single source of truth shared with the API route
 *     (same whitelist of fields, same counts, same ordering).
 *
 * Authorisation: `requireAnyPlatformRole()` runs first. If the caller has no
 * platform role we throw, which the layout / middleware handles.
 *
 * Forces dynamic rendering so the count snapshot is current on every visit
 * rather than baked at build time.
 */
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Workspaces · SevenF System Admin",
}

export default async function SystemWorkspacesPage() {
  await requireAnyPlatformRole()
  const workspaces = await listWorkspacesForSystem()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Building2 size={16} />
          <h1 className="text-base font-semibold">All tenants (read-only)</h1>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
          Listado completo de workspaces clientes. Solo metadatos y conteos.
          No se muestran mensajes, contenido de inbox, ni credenciales.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
          <span>{workspaces.length} workspaces</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100/70">
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Plan</Th>
                <Th align="right">Members</Th>
                <Th align="right">Conversations</Th>
                <Th align="right">Channels</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {workspaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-xs text-amber-900/60 dark:text-amber-100/50"
                  >
                    No hay workspaces todavía.
                  </td>
                </tr>
              ) : (
                workspaces.map((w) => <WorkspaceRow key={w.id} w={w} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function WorkspaceRow({ w }: { w: SystemWorkspaceSummary }) {
  return (
    <tr className="text-amber-950 dark:text-amber-50">
      <Td>
        <div className="flex flex-col leading-tight">
          <Link
            href={`/system/workspaces/${w.id}`}
            className="font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
          >
            {w.nombre}
          </Link>
          {w.vertical ? (
            <span className="text-[10px] uppercase tracking-wide text-amber-800/60 dark:text-amber-200/60">
              {w.vertical}
            </span>
          ) : null}
        </div>
      </Td>
      <Td>
        <code className="rounded bg-amber-100/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {w.slug}
        </code>
      </Td>
      <Td>
        <span className="inline-flex items-center rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
          {w.plan}
        </span>
      </Td>
      <Td align="right">{w.memberCount}</Td>
      <Td align="right">{w.conversationCount}</Td>
      <Td align="right">{w.channelCount}</Td>
      <Td>
        <span title={new Date(w.createdAt).toISOString()} className="text-xs text-amber-900/70 dark:text-amber-100/60">
          {formatDate(w.createdAt)}
        </span>
      </Td>
    </tr>
  )
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th
      className="px-3 py-2"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <td className="px-3 py-2 align-top" style={{ textAlign: align }}>
      {children}
    </td>
  )
}

/**
 * Date as `YYYY-MM-DD`. Avoids locale-dependent rendering between server and
 * client (would otherwise hydrate-mismatch on first paint).
 */
function formatDate(iso: string): string {
  return iso.slice(0, 10)
}
