import Link from "next/link"
import { Users } from "lucide-react"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import {
  listUsersForSystem,
  type SystemUserSummary,
  type SystemUserMembershipSummary,
} from "@core/system/users"

/**
 * Read-only directory of every user in the platform.
 *
 * Server component. Calls `listUsersForSystem()` directly — same reasoning
 * as `/system/workspaces/page.tsx`: server-to-self HTTP is wasted work and
 * the accessor is the single source of truth shared with the API route.
 *
 * Authorisation: `requireAnyPlatformRole()` runs first as defence in depth
 * (layout / middleware already gate the area).
 *
 * Forces dynamic rendering so the snapshot is current on every visit rather
 * than baked at build time.
 */
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Users · SevenF System Admin",
}

export default async function SystemUsersPage() {
  await requireAnyPlatformRole()
  const users = await listUsersForSystem()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Users size={16} />
          <h1 className="text-base font-semibold">All users (read-only)</h1>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
          Identidad, rol de plataforma (si aplica) y workspaces a los que
          pertenece. Sin contenido privado, sin último login, sin tokens.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-amber-200/60 bg-white/60 dark:border-amber-900/30 dark:bg-amber-950/10">
        <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-amber-900/60 dark:text-amber-100/50">
          <span>{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100/70">
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Platform role</Th>
                <Th>Workspaces &amp; roles</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/20">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-xs text-amber-900/60 dark:text-amber-100/50"
                  >
                    No hay usuarios todavía.
                  </td>
                </tr>
              ) : (
                users.map((u) => <UserRow key={u.id} u={u} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function UserRow({ u }: { u: SystemUserSummary }) {
  const initials = getInitials(u.nombre, u.email)
  return (
    <tr className="text-amber-950 dark:text-amber-50">
      <Td>
        <div className="flex items-center gap-2">
          {u.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.avatar}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-amber-300/50"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200/60 text-[11px] font-medium text-amber-900 ring-1 ring-amber-300/50 dark:bg-amber-950/40 dark:text-amber-100">
              {initials}
            </div>
          )}
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{u.nombre ?? "—"}</span>
            <span className="truncate font-mono text-[10px] text-amber-800/60 dark:text-amber-200/60">
              {u.id.slice(0, 12)}…
            </span>
          </div>
        </div>
      </Td>
      <Td>
        <span className="break-all">{u.email}</span>
      </Td>
      <Td>
        {u.platformRole ? (
          <span className="inline-flex items-center rounded-full border border-amber-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-600/40 dark:text-amber-300">
            {u.platformRole}
          </span>
        ) : (
          <span className="text-[11px] text-amber-900/40 dark:text-amber-100/40">—</span>
        )}
      </Td>
      <Td>
        {u.workspaceMemberships.length === 0 ? (
          <span className="text-[11px] text-amber-900/40 dark:text-amber-100/40">
            No memberships
          </span>
        ) : (
          <ul className="flex flex-col gap-1">
            {u.workspaceMemberships.map((m) => (
              <MembershipBadge key={m.workspaceId} m={m} />
            ))}
          </ul>
        )}
      </Td>
      <Td>
        <span className="text-xs text-amber-900/70 dark:text-amber-100/60">
          {formatDate(u.createdAt)}
        </span>
      </Td>
    </tr>
  )
}

function MembershipBadge({ m }: { m: SystemUserMembershipSummary }) {
  return (
    <li className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`/system/workspaces/${m.workspaceId}`}
        className="text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
      >
        {m.workspaceName}
      </Link>
      <code className="rounded bg-amber-100/60 px-1 py-0.5 font-mono text-[10px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {m.workspaceSlug}
      </code>
      <span className="rounded-full border border-amber-300/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:text-amber-300">
        {m.role}
      </span>
    </li>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>
}

function getInitials(nombre: string | null, email: string): string {
  const safe = (nombre ?? "").trim()
  if (safe.length > 0) {
    const parts = safe.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  const local = email.split("@")[0]
  return local.slice(0, 2).toUpperCase()
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}
