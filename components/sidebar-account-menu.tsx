"use client"

import { useMemo, useState } from "react"
import { LogOut, Building2, Loader2, Check, AlertCircle, ShieldCheck } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace, type ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface SidebarAccountMenuProps {
  collapsed: boolean
  /**
   * Inbox-focused mode tightens the sidebar gutters; the account menu uses this
   * to pick a slimmer footer layout. Visual-only — the data and logout behaviour
   * are identical in either mode.
   */
  focused?: boolean
}

/**
 * Friendly label for `WorkspaceMember.role` strings (which are not enums in
 * Prisma — see audit notes). We normalise unknown values to "Member" so a
 * legacy or mistyped value never surfaces raw text in the UI.
 */
function formatRoleLabel(role: string | null | undefined): string {
  switch ((role ?? "").toUpperCase()) {
    case "OWNER":
      return "Owner"
    case "ADMIN":
      return "Admin"
    case "MEMBER":
      return "Member"
    case "VIEWER":
      return "Viewer"
    default:
      return "Member"
  }
}

/**
 * Two-letter avatar fallback derived from the display name; falls back to the
 * email's local-part initial if no name is set, and finally to "?". Pure
 * presentation — never displays anything that wasn't already on `session`.
 */
function getInitials(name: string | null | undefined, email: string | undefined): string {
  const safeName = (name ?? "").trim()
  if (safeName.length > 0) {
    const parts = safeName.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  const local = (email ?? "").split("@")[0]
  if (local.length > 0) return local.slice(0, 2).toUpperCase()
  return "?"
}

/**
 * Replaces the previous mock footer ("Executive Admin / admin@7fcopilot.com / EA"
 * placeholder) with the real authenticated session + active workspace, plus a
 * visible Sign-out action.
 *
 * Data sources:
 *   - `useUser()`           → `/api/auth/me` (authenticated user identity).
 *   - `useActiveWorkspace()` → `/api/workspaces` (active tenant + role).
 *
 * Behaviour notes:
 *   - We deliberately do NOT redesign the sidebar footer; the trigger keeps the
 *     same visual footprint as the old static block (avatar + name/email stack)
 *     and only becomes a button-like dropdown trigger.
 *   - Logout posts to `/api/auth/logout` (POST, not GET, so it isn't pre-fetched
 *     by accident). The server clears both `7f-session` and `wf_workspace` and
 *     redirects to `/login`. We use a hard navigation (`window.location.href`)
 *     to wipe any client-side state — `useUser` is a context provider that
 *     lives at the app root and would otherwise keep stale data around for a
 *     beat after the redirect.
 *   - Loading state is intentionally minimal: a spinner in place of the avatar
 *     and "Loading…" / "Sign in…" labels. We never show stale account info.
 */
export function SidebarAccountMenu({ collapsed, focused = false }: SidebarAccountMenuProps) {
  const { user, loading: userLoading, isPlatformAdmin, platformRole } = useUser()
  const { workspace, workspaces, loading: wsLoading } = useActiveWorkspace()

  /**
   * Workspace switcher state. We track which `workspaceId` is currently being
   * activated so we can disable the buttons + show a spinner only on that row,
   * and a small inline error to surface 403/network failures without dumping
   * to the console alone.
   *
   * Security note: this state is purely UX. The decision of "can this user
   * switch into workspace X" lives entirely on the server in
   * `POST /api/workspaces/active`, which validates membership before flipping
   * the cookie. The client list comes from `GET /api/workspaces`, which only
   * returns the user's own memberships, so we don't render rows the server
   * would refuse anyway — but we still trust only the server's response.
   */
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const initials = useMemo(
    () => getInitials(user?.nombre, user?.email),
    [user?.nombre, user?.email],
  )

  const handleLogout = () => {
    /**
     * Hard navigation so the entire React tree unmounts and any cached fetches
     * (workspaces, conversations, todos, drafts) are discarded before the next
     * user lands. A SPA-style `router.push` would keep the in-memory cache.
     */
    window.location.href = "/api/auth/logout"
  }

  /**
   * Switch the active workspace. Hard-reload on success so every workspace-scoped
   * fetch in the running app (Inbox conversations, channels, clients, todos,
   * drafts, dashboards) re-runs against the new tenant. A `router.refresh()`
   * alone would re-fetch server components but leave the in-memory client
   * `useFetch` caches pointing at the previous workspace — that's the kind of
   * UI cross-tenant leak the recent audit specifically warns against.
   *
   * Errors keep the dropdown open with an inline message; the user can pick
   * another workspace or retry without re-opening the menu.
   */
  const handleSwitch = async (target: ActiveWorkspaceSummary) => {
    if (!target?.id || target.id === workspace?.id) return
    setSwitchError(null)
    setSwitchingId(target.id)
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId: target.id }),
      })
      if (!res.ok) {
        let message = `Could not switch workspace (HTTP ${res.status})`
        try {
          const json = await res.json()
          const errMsg =
            (json?.error?.message as string | undefined)
            ?? (typeof json?.message === "string" ? json.message : undefined)
          if (errMsg) message = errMsg
        } catch {
          /** Non-JSON response — keep the generic message. */
        }
        setSwitchError(message)
        setSwitchingId(null)
        return
      }
      /**
       * Don't bother updating local state: the next paint will be a full
       * reload, so flickering "switched" briefly here would be wasted work.
       */
      window.location.reload()
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "Network error switching workspace")
      setSwitchingId(null)
    }
  }

  if (userLoading || !user) {
    return (
      <FooterShell collapsed={collapsed} focused={focused}>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-sidebar-surface)] text-[var(--app-sidebar-text-muted)]">
          <Loader2 size={14} className="animate-spin" />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-[var(--app-sidebar-text-muted)]">
              Loading…
            </span>
          </div>
        )}
      </FooterShell>
    )
  }

  const displayName = user.nombre?.trim() || user.email
  const roleLabel = workspace ? formatRoleLabel(workspace.role) : null

  return (
    <FooterShell collapsed={collapsed} focused={focused} interactive>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40",
              "hover:bg-[var(--app-sidebar-surface)]/60",
              collapsed ? "justify-center p-1" : "p-1",
            )}
            title={collapsed ? `${displayName}${workspace ? ` · ${workspace.nombre}` : ""}` : undefined}
            aria-label="Open account menu"
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--app-sidebar-border)]"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-sidebar-surface)] text-xs font-medium text-[var(--app-sidebar-text)] ring-1 ring-[var(--app-sidebar-border)]">
                {initials}
              </div>
            )}
            {!collapsed && (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-xs font-medium text-[var(--app-sidebar-text)]">
                  {displayName}
                </span>
                <span className="truncate text-[10px] text-[var(--app-sidebar-text-muted)]">
                  {workspace?.nombre ?? (wsLoading ? "Loading workspace…" : "No workspace")}
                  {roleLabel ? ` · ${roleLabel}` : ""}
                </span>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "start" : "end"}
          className="min-w-[240px]"
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">
              {user.nombre?.trim() || "Account"}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/**
           * Workspace section. Two layouts share this slot:
           *  - When the user has 0 or 1 workspaces, we render the original
           *    static row (name + role pill) — there is nothing to switch to,
           *    so a switcher list would be visual noise.
           *  - When the user has 2+ memberships, we replace the static row with
           *    a labelled list where each row is a `DropdownMenuItem`. The
           *    active row is marked with a check icon and is non-interactive
           *    (clicking it is a no-op so we don't fire a redundant POST).
           */}
          <div className="px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 size={13} />
              <span className="text-[11px] uppercase tracking-wide">
                {workspaces.length > 1 ? "Switch workspace" : "Workspace"}
              </span>
            </div>
          </div>
          {workspaces.length > 1 ? (
            <div className="max-h-[260px] overflow-y-auto px-1 pb-1">
              {workspaces.map((w) => {
                const isActive = w.id === workspace?.id
                const isSwitching = switchingId === w.id
                const wRole = formatRoleLabel(w.role)
                return (
                  <DropdownMenuItem
                    key={w.id}
                    disabled={isActive || switchingId !== null}
                    onSelect={(event) => {
                      event.preventDefault()
                      handleSwitch(w)
                    }}
                    className={cn(
                      "cursor-pointer items-start gap-2 py-1.5",
                      isActive && "bg-accent/40",
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                      {isSwitching ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isActive ? (
                        <Check size={12} />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-medium">{w.nombre}</span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {w.slug}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-[var(--surface-overlay-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {wRole}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </div>
          ) : (
            <div className="px-2 pb-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {workspace?.nombre ?? (wsLoading ? "Loading…" : "—")}
                </span>
                {roleLabel ? (
                  <span className="shrink-0 rounded-full border border-[var(--surface-overlay-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {roleLabel}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          {switchError ? (
            <div className="mx-2 mb-1 flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="leading-snug">{switchError}</span>
            </div>
          ) : null}
          {/**
           * Platform section. Visible only to PlatformAdmins. Shown as a
           * SEPARATE section after the workspace switcher so it's never
           * confused with a customer workspace. We use a plain `<a>` (not
           * next/link, not the workspace switcher handler) for two reasons:
           *
           *   1. It's a HARD navigation. Going into `/system` must NOT touch
           *      `wf_workspace`; using the switcher API would set that
           *      cookie and corrupt the active workspace context.
           *   2. The server gets to re-read the JWT and stamp the right
           *      chrome from scratch.
           *
           * The platform admin can come back to their workspace via the
           * "Volver al workspace" button in `/system`'s header, which is
           * simply `<a href="/">` — no cookie work.
           */}
          {isPlatformAdmin ? (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck size={13} />
                  <span className="text-[11px] uppercase tracking-wide">Platform</span>
                </div>
              </div>
              <DropdownMenuItem asChild className="cursor-pointer">
                <a href="/system" className="flex items-center gap-2">
                  <ShieldCheck size={14} />
                  <span className="flex-1">SevenF System Admin</span>
                  {platformRole ? (
                    <span className="shrink-0 rounded-full border border-amber-400/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      {platformRole}
                    </span>
                  ) : null}
                </a>
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              handleLogout()
            }}
            className="cursor-pointer"
            disabled={switchingId !== null}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </FooterShell>
  )
}

/**
 * Wraps the trigger area so the desktop and mobile usages share the same
 * border / padding rules without duplicating layout strings. `interactive`
 * removes the static padding because the inner button supplies its own.
 */
function FooterShell({
  children,
  collapsed,
  focused,
  interactive = false,
}: {
  children: React.ReactNode
  collapsed: boolean
  focused: boolean
  interactive?: boolean
}) {
  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-[var(--app-sidebar-border)] pb-5 pt-4">
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn(
        "shrink-0 border-t border-[var(--app-sidebar-border)]",
        focused ? "px-3 pb-4 pt-3" : "px-4 pb-5 pt-4",
        interactive && "px-2",
      )}
    >
      {children}
    </div>
  )
}
