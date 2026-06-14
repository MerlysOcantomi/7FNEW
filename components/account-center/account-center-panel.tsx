"use client"

import Link from "next/link"
import {
  AlertCircle,
  ArrowRightLeft,
  Building2,
  CreditCard,
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { ActiveWorkspaceSummary } from "@/hooks/use-active-workspace"
import { cn } from "@/lib/utils"
import { ThemeModeToggle } from "@/components/theme-mode-toggle"

/**
 * Account Center Panel
 * --------------------
 *
 * Replaces the previous compact dropdown that lived inside
 * `SidebarAccountMenu`. The brief was:
 *
 *   "Make it feel like the global New menu, but opened from the bottom
 *   account/avatar trigger."
 *
 * So the visual language is intentionally cloned from
 * `components/global-new/global-new-desktop-panel.tsx` +
 * `components/global-new/global-new-item.tsx`:
 *
 *   - Surface          → `bg-[var(--app-shell-bg)]` + `border-[var(--border-dark)]`
 *   - Section labels   → `text-[10px] uppercase tracking-wider text-[var(--text-secondary-light)]`
 *   - Action rows      → 36px icon wrap, title + sub-text, hover `bg-[var(--app-surface-hover)]`
 *   - Icon treatment   → `h-9 w-9 rounded-lg border` chip with `--accent-primary`
 *   - Spacing          → 16–24px gutter, 4px inter-item, 8px column gap
 *
 * Functional differences from the New menu (intentional):
 *   - The active workspace is rendered as a NON-INTERACTIVE card, not a
 *     "disabled menu item". The previous design rendered it as a
 *     greyed-out list row and the user reported this as confusing — the
 *     card is now visually distinct (accent stripe + "You are here").
 *   - The "Switch workspace" list filters the active workspace OUT, so
 *     the panel never shows the same workspace twice.
 *   - The Platform link to `/system` is intentionally a hard `<a>`
 *     navigation (not `<Link>`). Going into `/system` MUST NOT touch
 *     `wf_workspace`, and the chrome there is rebuilt server-side.
 *
 * Backend untouched:
 *   - Workspace switch still POSTs to `/api/workspaces/active` via the
 *     parent's `onSwitch` callback. The full reload is the parent's
 *     responsibility.
 *   - Sign out still hits `/api/auth/logout` via the parent's
 *     `onLogout` callback.
 *   - This component is presentation-only; it never reads cookies, never
 *     calls Prisma, never inspects PlatformAdmin. All authorisation
 *     decisions live server-side.
 */

type AccountCenterUser = {
  email: string
  nombre?: string | null
  avatar?: string | null
  initials: string
}

interface AccountCenterPanelProps {
  user: AccountCenterUser
  workspace: ActiveWorkspaceSummary | null
  otherWorkspaces: ActiveWorkspaceSummary[]
  isPlatformAdmin: boolean
  platformRole: string | null
  switchingId: string | null
  switchError: string | null
  loggingOut: boolean
  wsLoading: boolean
  wsError: string | null
  onSwitch: (target: ActiveWorkspaceSummary) => void
  onLogout: () => void
  /**
   * Called whenever the panel makes a navigation request that should
   * close it (settings link clicks, platform link click, workspace
   * switch). The hard reload after a successful switch already replaces
   * the tree; this callback only matters for navigations that stay in
   * the SPA (Settings) or open a new tab.
   */
  onClose: () => void
}

/**
 * Friendly label for `WorkspaceMember.role` strings (mirror of the helper
 * inside `SidebarAccountMenu` — duplicated here so the panel stays
 * standalone). Unknown roles fall back to "Member" so a legacy or
 * mistyped value never surfaces as raw text.
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
 * Settings catalogue. We keep this static, declarative and inside the
 * component file because it's purely presentational metadata — no
 * authorisation lives here. Server-side routes still gate access for
 * each destination, and `disabled` items render a "Soon" tag without a
 * route so we never link to a 404.
 *
 * Real routes were verified against `app/administracion/**` before
 * adding them: `/administracion` and `/administracion/canales` exist
 * today, so they are wired live. The other items are placeholders we'll
 * activate as the corresponding pages land.
 */
type SettingsItem = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  href?: string
  /**
   * Marks an item as not yet shipped. Renders as a non-clickable row
   * with a "Soon" tag. Avoids 404s while the destination is being
   * built. Flip to `false` and add `href` once the page exists.
   */
  comingSoon?: boolean
}

const SETTINGS_ITEMS: SettingsItem[] = [
  {
    id: "workspace-settings",
    label: "Workspace settings",
    description: "Configuración general del workspace",
    icon: SettingsIcon,
    href: "/administracion",
  },
  {
    id: "members",
    label: "Members",
    description: "Invitaciones y roles del equipo",
    icon: Users,
    comingSoon: true,
  },
  {
    id: "plan-usage",
    label: "Plan & usage",
    description: "Plan actual, consumo y facturación",
    icon: CreditCard,
    comingSoon: true,
  },
  {
    id: "profile",
    label: "My profile",
    description: "Datos personales y preferencias",
    icon: UserCircle,
    comingSoon: true,
  },
  {
    id: "security",
    label: "Account security",
    description: "Sesiones activas y autenticación",
    icon: KeyRound,
    comingSoon: true,
  },
]

/**
 * Section heading. Same uppercase tracking-wider treatment as the New
 * menu — extracted so we don't repeat the class string four times.
 */
function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">
      {Icon ? <Icon size={11} className="shrink-0" /> : null}
      {children}
    </p>
  )
}

/**
 * Generic action row. Mirrors `GlobalNewItem` (icon chip + title +
 * description + hover) but stays workspace-aware: it can render as
 * link, button, or "coming soon" non-interactive line. Right slot is
 * for trailing badges (role pill, "Soon" tag, loading spinner, etc.).
 */
function ActionRow({
  icon: Icon,
  iconAccent = "var(--accent-primary)",
  title,
  description,
  trailing,
  href,
  onClick,
  disabled,
  isExternal,
  className,
}: {
  icon: LucideIcon
  iconAccent?: string
  title: string
  description?: string
  trailing?: React.ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  /**
   * If `true`, renders the row with `<a>` instead of `<Link>` so the
   * navigation is a hard reload (used by `/system` to ensure a fresh
   * server render that re-reads the JWT and stamps the amber chrome).
   */
  isExternal?: boolean
  className?: string
}) {
  const inner = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)]",
          disabled && "opacity-50",
        )}
      >
        <Icon
          className="h-4 w-4 shrink-0 stroke-[1.75]"
          style={{ color: iconAccent }}
        />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-sm font-medium leading-snug text-[var(--app-sidebar-text)]",
            disabled && "text-[var(--text-secondary-light)]",
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-secondary-light)]">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="ml-2 flex shrink-0 items-center gap-1">{trailing}</span>
      ) : null}
    </>
  )

  const baseClass = cn(
    "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors",
    disabled
      ? "cursor-not-allowed"
      : "hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
    className,
  )

  if (disabled) {
    return (
      <div className={baseClass} aria-disabled="true">
        {inner}
      </div>
    )
  }

  if (href && isExternal) {
    return (
      <a href={href} className={baseClass} onClick={onClick}>
        {inner}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} className={baseClass} onClick={onClick}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" className={baseClass} onClick={onClick}>
      {inner}
    </button>
  )
}

/**
 * Small role pill — same shape as the New menu's badge treatment but
 * neutral-toned (workspace roles are not security-sensitive in the UI).
 */
function RolePill({ role, accent = false }: { role: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide",
        accent
          ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
          : "border-[var(--border-dark)] bg-[var(--app-surface-subtle)] text-[var(--text-secondary-light)]",
      )}
    >
      {role}
    </span>
  )
}

function ComingSoonTag() {
  return (
    <span className="shrink-0 rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-[var(--text-secondary-light)]">
      Soon
    </span>
  )
}

export function AccountCenterPanel({
  user,
  workspace,
  otherWorkspaces,
  isPlatformAdmin,
  platformRole,
  switchingId,
  switchError,
  loggingOut,
  wsLoading,
  wsError,
  onSwitch,
  onLogout,
  onClose,
}: AccountCenterPanelProps) {
  const roleLabel = workspace ? formatRoleLabel(workspace.role) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/**
       * Header band — same surface as the panel itself, with a thin
       * separator below. Sticks to the top of the Sheet via the parent
       * flex column (header + scroll body + footer is the canonical
       * Sheet layout). Mirrors the "Create across your workspace"
       * subtitle pattern from the New mobile sheet, adapted to "Account
       * Center" identity.
       */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-dark)] px-5 py-4">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[var(--border-dark)]"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-hover)] text-sm font-medium text-[var(--app-sidebar-text)] ring-1 ring-[var(--border-dark)]">
            {user.initials}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--app-sidebar-text)]">
              {user.nombre?.trim() || "Account"}
            </span>
            {isPlatformAdmin && platformRole ? (
              <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-300">
                {platformRole}
              </span>
            ) : null}
          </div>
          <span className="truncate text-[11px] text-[var(--text-secondary-light)]">
            {user.email}
          </span>
        </div>
      </div>

      {/**
       * Scrollable body. The panel lives inside a Sheet now, so we let
       * this region grow to fill all the vertical space the Sheet
       * container offers and scroll on overflow. `min-h-0` is the
       * crucial bit — without it the flex child refuses to shrink and
       * the inner content would clip the Sheet bottom instead of
       * scrolling.
       *
       * Layout strategy:
       *   - Single column when the Sheet itself is narrow (typical
       *     480px desktop + mobile widths).
       *   - Two columns automatically when the Sheet is ≥720px wide
       *     (e.g. tablet or wider desktop overrides). We use Tailwind
       *     v4 container queries (`@container` + `@[720px]`) so the
       *     layout is driven by the *Sheet's* width, NOT the viewport
       *     — viewport-based `sm:`/`md:` would be wrong here because
       *     the Sheet has a fixed width regardless of how big the
       *     window is.
       *
       * Column 1 keeps Workspaces + Platform (they answer "where am I
       * / where can I go"); Column 2 keeps Settings (it answers "what
       * can I configure"). Sign out lives in the panel footer, never
       * in either column.
       */}
      <div className="@container min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="grid min-w-0 gap-6 @[720px]:grid-cols-2">
          <div className="min-w-0 space-y-5">
          <section>
            <SectionHeading icon={Building2}>Workspaces</SectionHeading>

            {/**
             * Current workspace card. Plain `<div>` (NOT a focusable
             * item) so it never sits in the keyboard tab order and
             * never looks "disabled". Accent stripe + "You are here"
             * text replace the previous greyed-out row.
             */}
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary-light)]/80">
              Current workspace
            </p>
            {workspace ? (
              <div
                role="group"
                aria-label="Current workspace"
                className="relative mb-4 flex items-start gap-2 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2.5 py-2"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[var(--accent-primary)]/70"
                />
                <Building2
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--accent-primary)]"
                />
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--app-sidebar-text)]">
                      {workspace.nombre}
                    </span>
                    {roleLabel ? <RolePill role={roleLabel} /> : null}
                  </div>
                  <span className="truncate text-[10.5px] text-[var(--text-secondary-light)]">
                    {workspace.slug}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--accent-primary)]/85">
                    You are here
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-dashed border-[var(--border-dark)] px-2.5 py-2 text-xs text-[var(--text-secondary-light)]">
                {wsLoading ? "Loading workspace…" : "No active workspace"}
              </div>
            )}

            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary-light)]/80">
              <ArrowRightLeft size={11} className="shrink-0" />
              Switch workspace
            </p>
            {wsError ? (
              <p className="text-[11px] italic text-destructive">
                Couldn&apos;t load workspaces. Try reopening the panel.
              </p>
            ) : otherWorkspaces.length > 0 ? (
              <ul className="space-y-0.5">
                {otherWorkspaces.map((w) => {
                  const isSwitching = switchingId === w.id
                  const wRole = formatRoleLabel(w.role)
                  return (
                    <li key={w.id}>
                      <ActionRow
                        icon={Building2}
                        title={w.nombre}
                        description={w.slug}
                        onClick={() => onSwitch(w)}
                        disabled={switchingId !== null}
                        trailing={
                          <>
                            {isSwitching ? (
                              <Loader2
                                size={12}
                                className="animate-spin text-[var(--text-secondary-light)]"
                              />
                            ) : null}
                            <RolePill role={wRole} />
                          </>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-2 text-[11px] italic text-[var(--text-secondary-light)]">
                No other workspaces available
              </p>
            )}

            {switchError ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span className="leading-snug">{switchError}</span>
              </div>
            ) : null}
          </section>

          {/**
           * Platform section — only rendered for PlatformAdmin. Lives
           * inside the Workspaces column on purpose: it's about
           * "where can I go", not about "what can I configure". Hard
           * `<a>` navigation (NOT `<Link>`) preserves the cookie
           * separation: `/system` must not touch `wf_workspace`.
           */}
          {isPlatformAdmin ? (
            <section>
              <SectionHeading icon={ShieldCheck}>Platform</SectionHeading>
              <ul className="space-y-0.5">
                <li>
                  <ActionRow
                    icon={ShieldCheck}
                    iconAccent="rgb(245, 158, 11)"
                    title="SevenF System Admin"
                    description="Control plane (no es un workspace)"
                    href="/system"
                    isExternal
                    onClick={onClose}
                    trailing={
                      platformRole ? (
                        <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-300">
                          {platformRole}
                        </span>
                      ) : null
                    }
                  />
                </li>
              </ul>
            </section>
          ) : null}
          </div>

          <div className="min-w-0 space-y-5">
            <section>
              <SectionHeading icon={SettingsIcon}>Settings</SectionHeading>
              <ul className="space-y-0.5">
                {SETTINGS_ITEMS.map((item) => (
                  <li key={item.id}>
                    <ActionRow
                      icon={item.icon}
                      title={item.label}
                      description={item.description}
                      href={item.href}
                      onClick={onClose}
                      disabled={Boolean(item.comingSoon)}
                      trailing={item.comingSoon ? <ComingSoonTag /> : null}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionHeading icon={Palette}>Appearance</SectionHeading>
              <ThemeModeToggle />
              <p className="mt-2 text-[11px] leading-snug text-[var(--text-secondary-light)]">
                Midnight is the default. Lavender Mist is an in-progress light
                theme — some areas may still show dark styling.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/**
       * Footer — sign out lives here so it never visually mingles with
       * settings or workspace switching. Sticks to the bottom of the
       * Sheet via the parent flex column. Same hard navigation flow we
       * already had (`window.location.href = "/api/auth/logout"`).
       */}
      <div className="shrink-0 border-t border-[var(--border-dark)] px-3 py-2">
        <button
          type="button"
          onClick={onLogout}
          disabled={switchingId !== null || loggingOut}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors",
            "text-[var(--app-sidebar-text)] hover:bg-[var(--app-surface-hover)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)]">
            {loggingOut ? (
              <Loader2 size={14} className="animate-spin text-[var(--text-secondary-light)]" />
            ) : (
              <LogOut size={14} className="text-[var(--text-secondary-light)]" />
            )}
          </span>
          <span className="flex flex-col leading-tight">
            <span>Sign out</span>
            <span className="text-[11px] font-normal text-[var(--text-secondary-light)]">
              Cierra sesión en este dispositivo
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
