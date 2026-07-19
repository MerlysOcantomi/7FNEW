/**
 * Account Center — Settings catalogue (pure data, no React).
 *
 * Extracted from `account-center-panel.tsx` so the routing contract is
 * testable without rendering the Sheet: each entry declares IDENTITY
 * (`id`/`catalogKey`) and ROUTE (`href`) only — copy resolves from
 * `settings.accountCenter.items` and icons from the panel's icon map at
 * render time. `disabled` items render a "Soon" tag without a route so we
 * never link to a 404.
 *
 * Real routes were verified against `app/**` before adding them:
 * `/administracion` and `/business-profile` exist today, so they are wired
 * live. The other items are placeholders we'll activate as the
 * corresponding pages land.
 */
export type SettingsItemCatalogKey =
  | "workspaceSettings"
  | "businessProfile"
  | "members"
  | "planUsage"
  | "profile"
  | "security"

export interface SettingsItemDef {
  id: string
  /** Copy comes from `settings.accountCenter.items` at render time. */
  catalogKey: SettingsItemCatalogKey
  href?: string
  /**
   * Marks an item as not yet shipped. Renders as a non-clickable row
   * with a "Soon" tag. Avoids 404s while the destination is being
   * built. Flip to `false` and add `href` once the page exists.
   */
  comingSoon?: boolean
}

export const SETTINGS_ITEMS: SettingsItemDef[] = [
  {
    id: "workspace-settings",
    catalogKey: "workspaceSettings",
    href: "/administracion",
  },
  /**
   * Business profile — the workspace's public/business identity editor.
   * This is the settings-side entry for the same concept the Beauty
   * overview links from its salon profile card: it must open the editor
   * at `/business-profile`, never the "Mi salón" overview at `/`.
   */
  {
    id: "business-profile",
    catalogKey: "businessProfile",
    href: "/business-profile",
  },
  { id: "members", catalogKey: "members", comingSoon: true },
  { id: "plan-usage", catalogKey: "planUsage", comingSoon: true },
  { id: "profile", catalogKey: "profile", comingSoon: true },
  { id: "security", catalogKey: "security", comingSoon: true },
]
