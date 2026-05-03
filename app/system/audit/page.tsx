import { ScrollText } from "lucide-react"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listPlatformAuditLogs, type PlatformAuditEntry } from "@core/system/audit"

/**
 * Read-only audit page. Same shape as `/system/workspaces` and `/system/users`:
 *
 *   - Server component, dynamic rendering (the trail must be fresh on every
 *     visit, never baked at build time).
 *   - Calls the data accessor directly. No server-to-self HTTP fetch.
 *   - Authorisation: `requireAnyPlatformRole()` runs first.
 *
 * The display deliberately stays minimal: a chronological table. Filtering,
 * pagination and full-detail views are explicit follow-ups; for now the
 * goal is "operators can see what happened recently".
 */
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Audit log · SevenF System Admin",
}

export default async function SystemAuditPage() {
  await requireAnyPlatformRole()
  const logs = await listPlatformAuditLogs({ limit: 100 })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <ScrollText size={16} />
          <h1 className="text-base font-semibold">Audit log (read-only)</h1>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
          Últimas {logs.length} acciones del control plane. Los metadatos están
          sanitizados — nunca contienen tokens, credenciales, ni cuerpos de
          mensajes/email.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100/70">
              <tr>
                <Th>Created</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Metadata</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-xs text-amber-900/60 dark:text-amber-100/50"
                  >
                    Sin eventos todavía.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => <AuditRow key={entry.id} entry={entry} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AuditRow({ entry }: { entry: PlatformAuditEntry }) {
  return (
    <tr className="text-amber-950 align-top dark:text-amber-50">
      <Td>
        <span
          title={new Date(entry.createdAt).toISOString()}
          className="text-xs text-amber-900/80 dark:text-amber-100/70"
        >
          {formatDateTime(entry.createdAt)}
        </span>
      </Td>
      <Td>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-amber-950 dark:text-amber-50">
            {entry.actorName ?? entry.actorEmail ?? entry.actorId}
          </span>
          {entry.actorEmail && entry.actorEmail !== entry.actorName ? (
            <span className="text-[10px] text-amber-900/60 dark:text-amber-200/60">
              {entry.actorEmail}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-amber-900/50 dark:text-amber-200/50">
              {entry.actorId}
            </span>
          )}
        </div>
      </Td>
      <Td>
        <code className="rounded bg-amber-100/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {entry.action}
        </code>
      </Td>
      <Td>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wide text-amber-800/70 dark:text-amber-200/70">
            {entry.targetType}
          </span>
          <span className="font-mono text-[11px] text-amber-900/80 dark:text-amber-100/70">
            {entry.targetId}
          </span>
        </div>
      </Td>
      <Td>
        <MetadataSummary metadata={entry.metadata} />
      </Td>
      <Td>
        {entry.ip ? (
          <span
            title={entry.userAgent ?? undefined}
            className="font-mono text-[11px] text-amber-900/80 dark:text-amber-100/70"
          >
            {entry.ip}
          </span>
        ) : (
          <span className="text-[11px] italic text-amber-900/40 dark:text-amber-100/30">
            —
          </span>
        )}
      </Td>
    </tr>
  )
}

/**
 * Compact rendering of the metadata blob. Audit metadata is intentionally
 * small (sanitised + truncated by `logPlatformAudit`), so a one-line
 * "key: value · key: value" summary is usually readable. We cap to 4 keys
 * with a "+N more" tail — the full payload remains in the DB if a deeper
 * inspection is ever needed (future drill-in page).
 */
function MetadataSummary({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <span className="text-[11px] italic text-amber-900/40 dark:text-amber-100/30">
        —
      </span>
    )
  }
  const entries = Object.entries(metadata)
  const visible = entries.slice(0, 4)
  const more = entries.length - visible.length

  return (
    <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
      {visible.map(([k, v]) => (
        <span key={k} className="font-mono">
          <span className="text-amber-900/70 dark:text-amber-100/60">{k}:</span>{" "}
          <span className="text-amber-950 dark:text-amber-50">
            {renderValue(v)}
          </span>
        </span>
      ))}
      {more > 0 ? (
        <span className="text-[10px] italic text-amber-900/50 dark:text-amber-100/40">
          +{more} más
        </span>
      ) : null}
    </div>
  )
}

function renderValue(v: unknown): string {
  if (v === null) return "null"
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 60) + "…" : v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    const json = JSON.stringify(v)
    return json.length > 60 ? json.slice(0, 60) + "…" : json
  } catch {
    return "[unserialisable]"
  }
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th className="px-3 py-2" style={{ textAlign: align }}>
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
 * Audit-friendly timestamp: `YYYY-MM-DD HH:mm:ss` in UTC. The full ISO is
 * available on hover (see `title` in the cell) for precise timezone work.
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mi = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}
