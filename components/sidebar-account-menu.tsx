"use client"

import { useMemo, useState } from "react"
import { LogOut, Building2, Loader2, AlertCircle, ShieldCheck, ArrowRightLeft } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useActiveWorkspace, type ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

  /**
   * Workspaces *other than* the active one — what the "Switch workspace"
   * section iterates. Kept derived (not stored) so it stays in sync with
   * `useActiveWorkspace()` whenever the active workspace flips. The
   * filter is purely visual: the server re-validates membership inside
   * `POST /api/workspaces/active` regardless of what the client lists.
   *
   * If `workspace` is `null` (loading / 401), we fall back to showing
   * every workspace as switchable — that mirrors the old behaviour and
   * lets the UX recover gracefully when the active cookie is stale.
   */
  const otherWorkspaces = useMemo(
    () =>
      workspace
        ? workspaces.filter((w) => w.id !== workspace.id)
        : workspaces,
    [workspaces, workspace],
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
          className="min-w-[280px] p-0"
        >
          {/**
           * Header. The trigger row already shows avatar + name + email +
           * role, but inside the dropdown we restate it on its own band so
           * the operator's identity is visible even when the workspace
           * sections scroll. Avatar bumped to 32px because the band has
           * room and a slightly larger photo reads better than the trigger
           * size. We never read or display anything that wasn't already on
           * `useUser()`.
           */}
          <div className="flex items-center gap-3 px-3 py-3">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--surface-overlay-border)]"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground ring-1 ring-[var(--surface-overlay-border)]">
                {initials}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold">
                {user.nombre?.trim() || "Account"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>

          <DropdownMenuSeparator className="m-0" />

          {/**
           * Current workspace card. Rendered as a *non-interactive* block
           * (plain `<div>` — NOT a `DropdownMenuItem`) so it never appears
           * in the keyboard focus loop and never looks "disabled". The
           * accent stripe + tint signal "you are here" without burning a
           * checkmark icon (which the previous design used and the user
           * reported as confusing).
           */}
          <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Current workspace
          </DropdownMenuLabel>
          <div className="px-2 pb-2">
            {workspace ? (
              <div
                role="group"
                aria-label="Current workspace"
                className="relative flex items-start gap-2 rounded-md border border-[var(--app-accent)]/25 bg-[var(--app-accent)]/10 px-2.5 py-2"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[var(--app-accent)]/60"
                />
                <Building2 size={14} className="mt-0.5 shrink-0 text-[var(--app-accent)]" />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {workspace.nombre}
                    </span>
                    {roleLabel ? (
                      <span className="shrink-0 rounded-full border border-[var(--surface-overlay-border)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
                        {roleLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="truncate text-[10.5px] text-muted-foreground">
                    {workspace.slug}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--app-accent)]/80">
                    You are here
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--surface-overlay-border)] px-2.5 py-2 text-xs text-muted-foreground">
                {wsLoading ? "Loading workspace…" : "No active workspace"}
              </div>
            )}
          </div>

          {/**
           * Switch workspace section. Renders ONLY workspaces that are not
           * the active one — the active workspace is already represented
           * by the "Current workspace" card above, so listing it here
           * again as a disabled row is redundant noise (and the source of
           * the "Why is it grayed out?" confusion the operator reported).
           *
           * Empty state when the user is a member of a single workspace:
           * a muted line, no list, so the section never looks "broken".
           *
           * Security boundary unchanged: the client only iterates the
           * `workspaces` array returned by `GET /api/workspaces`, and the
           * actual switch goes through `POST /api/workspaces/active` which
           * re-validates membership server-side. Filtering the active
           * workspace out is purely visual.
           */}
          <DropdownMenuSeparator className="m-0" />
          <DropdownMenuLabel className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ArrowRightLeft size={12} className="shrink-0" />
            Switch workspace
          </DropdownMenuLabel>
          {otherWorkspaces.length > 0 ? (
            <DropdownMenuGroup className="max-h-[260px] overflow-y-auto px-1 pb-1">
              {otherWorkspaces.map((w) => {
                const isSwitching = switchingId === w.id
                const wRole = formatRoleLabel(w.role)
                return (
                  <DropdownMenuItem
                    key={w.id}
                    disabled={switchingId !== null}
                    onSelect={(event) => {
                      event.preventDefault()
                      handleSwitch(w)
                    }}
                    className="cursor-pointer items-start gap-2 rounded-md px-2 py-2"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                      {isSwitching ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Building2 size={12} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{w.nombre}</span>
                      <span className="truncate text-[10.5px] text-muted-foreground">
                        {w.slug}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-[var(--surface-overlay-border)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      {wRole}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          ) : (
            <p className="px-3 pb-2 text-[11px] italic text-muted-foreground">
              No other workspaces available
            </p>
          )}

          {switchError ? (
            <div className="mx-2 mb-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span className="leading-snug">{switchError}</span>
            </div>
          ) : null}

          {/**
           * Platform section. Visible only to PlatformAdmins. Lives in its
           * own band so it's never visually mixed with customer
           * workspaces. We keep the plain `<a>` (NOT the switcher handler)
           * for the same reasons as before:
           *   1. Hard navigation — going into `/system` must NOT touch
           *      `wf_workspace`. The switcher API sets that cookie.
           *   2. The server re-reads the JWT and stamps the amber chrome
           *      from scratch.
           */}
          {isPlatformAdmin ? (
            <>
              <DropdownMenuSeparator className="m-0" />
              <DropdownMenuLabel className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck size={12} className="shrink-0" />
                Platform
              </DropdownMenuLabel>
              <div className="px-1 pb-1">
                <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-2">
                  <a href="/system" className="flex items-center gap-2">
                    <ShieldCheck size={14} className="shrink-0 text-amber-500" />
                    <span className="flex-1 text-sm font-medium">SevenF System Admin</span>
                    {platformRole ? (
                      <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-50/40 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {platformRole}
                      </span>
                    ) : null}
                  </a>
                </DropdownMenuItem>
              </div>
            </>
          ) : null}

          {/**
           * Sign out lives in its own footer band — visually divorced
           * from any workspace action so the operator never confuses
           * "switching out" with "logging out". Keeping the same hard
           * navigation flow (`window.location.href = "/api/auth/logout"`)
           * we already had.
           */}
          <DropdownMenuSeparator className="m-0" />
          <div className="px-1 py-1">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                handleLogout()
              }}
              className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium"
              disabled={switchingId !== null}
            >
              <LogOut size={14} className="shrink-0" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </div>
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
