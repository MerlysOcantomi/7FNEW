/**
 * Typed UI namespace foundation — type contracts only (leaf, no runtime data).
 *
 * These namespaces back the *visible application UI* (app shell, nav, future
 * surfaces). They are intentionally separate from the legacy `TranslationSet`
 * (email / notifications / activity), which stays in `../types` and continues to
 * serve its existing consumers. Do NOT copy email/notification/activity strings
 * into these namespaces — there must be a single source per message.
 *
 * Keys are stable English identifiers. Vocabulary (Client → Clienta/Patient)
 * stays a separate resolver layer and must NOT be merged in here.
 *
 * Message conventions (frozen — see docs/i18n-localization-architecture.md §10):
 * - Keys are camelCase (`saveChanges`, not `save_changes`).
 * - Nested objects are allowed when they form one semantic unit
 *   (e.g. `empty: { title, body }`, `inbox: { title, needsAction }`).
 * - Typed TypeScript functions are allowed as values for interpolation,
 *   pluralization, and composition with vertical vocabulary
 *   (e.g. `count: (count: number, clientPlural: string) => string`).
 * - Every locale file of a namespace must satisfy the SAME interface from this
 *   file — a missing key in any locale is a compile error, by design.
 * - Vertical vocabulary is interpolation DATA, never a key: no `clienta.*`,
 *   no business nouns baked into these global UI catalogs.
 */

/** Shared labels reused across UI surfaces (buttons, generic actions). */
export interface CommonMessages {
  save: string
  cancel: string
  edit: string
  delete: string
  close: string
  search: string
  loading: string
  saveChanges: string
}

/**
 * Navigation + shell-control labels.
 *
 * Entity items (clients/calendar/inbox/billing/services/team/tasks/finance/
 * marketing) are LOCALE FALLBACKS: when the workspace's vertical vocabulary
 * explicitly overrides the entity noun (Beauty → Clientas/Agenda/Mensajes/
 * Cobros), the vocabulary wins via `composeEntityLabel` — the catalog never
 * hardcodes a vertical's noun. Structural labels (today/more/new/search and
 * the a11y controls) are pure locale strings.
 */
export interface NavMessages {
  today: string
  calendar: string
  clients: string
  inbox: string
  services: string
  billing: string
  team: string
  settings: string
  tasks: string
  finance: string
  marketing: string
  more: string
  new: string
  search: string
  expandSidebar: string
  collapseSidebar: string
  openNavigation: string
  closeNavigation: string
  navigationTitle: string
  backToWorkspace: string
}

/** Global search chrome (trigger, dialog frame, footer hints) — not results. */
export interface GlobalSearchMessages {
  placeholder: string
  introTitle: string
  introSubtitle: string
  quickNavigation: string
  exampleSearchesAria: string
  loading: string
  close: string
  dialogAria: string
  footer: {
    navigate: string
    open: string
    close: string
  }
}

/** Global "New" menu chrome (trigger, panel frame, group headings) — not items. */
export interface GlobalNewMessages {
  trigger: string
  title: string
  subtitle: string
  close: string
  groups: {
    capture: string
    work: string
    assets: string
    vertical: string
  }
}

/**
 * Settings surface — the language controls, the Account Center chrome and the
 * Administración page chrome (doc §9). Account Center / admin-page copy lives
 * here (nested semantic units) rather than in new top-level namespaces: both
 * are facets of the settings surface in the doc's namespace registry.
 */
export interface SettingsMessages {
  title: string
  language: {
    appLabel: string
    appDescription: string
    workspaceLabel: string
    workspaceDescription: string
    /** Shown when the user has no personal preference and follows the fallback. */
    followingDefault: string
    /** CTA that clears `User.locale` so the UI follows the workspace again. */
    useWorkspaceLanguage: string
    clearedToast: string
    updatedToast: string
    updateErrorTitle: string
    updateErrorBody: string
    workspaceUpdatedToast: string
    workspaceUpdateErrorTitle: string
    /** Read-only note for members without admin rights on the workspace control. */
    workspaceReadOnly: string
  }
  /** Account Center panel chrome (sections, states, sign-out, settings rows). */
  accountCenter: {
    workspacesSection: string
    currentWorkspace: string
    youAreHere: string
    switchWorkspace: string
    noOtherWorkspaces: string
    workspacesLoadError: string
    loadingWorkspace: string
    noActiveWorkspace: string
    platformSection: string
    platformDescription: string
    settingsSection: string
    languageSection: string
    appearanceSection: string
    appearanceNote: string
    comingSoon: string
    signOut: string
    signOutDescription: string
    items: {
      workspaceSettings: { label: string; description: string }
      members: { label: string; description: string }
      planUsage: { label: string; description: string }
      profile: { label: string; description: string }
      security: { label: string; description: string }
    }
  }
  /** Administración page chrome (header + notices; capability catalog is NOT here). */
  adminPage: {
    eyebrow: string
    title: string
    subtitle: string
    adminOnlyNotice: string
    emailChannelsLink: string
    emailChannelsNote: string
  }
}

/** Today surface — header, empty state and global-chrome frame labels. */
export interface TodayMessages {
  title: string
  empty: {
    title: string
    body: string
  }
  /** Global Today peek chrome (header CTA + close) — not the peek body copy. */
  chrome: {
    openFull: string
    close: string
  }
}

/**
 * Clients surface. Business nouns (Client → Clienta/Patient) are interpolation
 * DATA supplied by the vocabulary resolver — never keys in this catalog.
 */
export interface ClientsMessages {
  title: string
  newButton: string
  /** `clientPlural` comes from the vocabulary resolver (caller lowercases it). */
  searchPlaceholder: (args: { clientPlural: string }) => string
  /** Basic pluralization: the vocabulary noun already carries the plural form. */
  count: (count: number, clientPlural: string) => string
  empty: {
    title: string
    body: string
  }
}

/** Calendar surface — visible labels only; no calendar behavior lives here. */
export interface CalendarMessages {
  title: string
  today: string
  empty: string
}

/** Billing surface — visible labels only; no finance behavior lives here. */
export interface BillingMessages {
  title: string
  newInvoice: string
  empty: string
}

/** All UI namespaces available to `getUIMessages` / `getNamespace`. */
export interface UIMessages {
  common: CommonMessages
  nav: NavMessages
  globalSearch: GlobalSearchMessages
  globalNew: GlobalNewMessages
  settings: SettingsMessages
  today: TodayMessages
  clients: ClientsMessages
  calendar: CalendarMessages
  billing: BillingMessages
}

/** Union of valid namespace keys. */
export type UINamespace = keyof UIMessages
