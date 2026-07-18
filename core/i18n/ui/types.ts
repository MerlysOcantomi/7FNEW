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
  /** Structural label for the vertical overview item ("My salon" / "Mi salón"). */
  mySalon: string
  /** Neutral, function-describing helper subtitles for vertical nav items. */
  helpers: {
    marketing: string
    billing: string
    forteLab: string
  }
  /**
   * Focused Inbox chrome + filter labels (rendered on /inbox in every
   * workspace). `title`/`byFanny` are product/agent branding sourced from the
   * catalog so a locale MAY localize them; filter items and group separators
   * are plain UI copy. Keys are stable — the sidebar derives them from each
   * item's `?filter=` value, never from the visible label.
   */
  smartInbox: {
    title: string
    byFanny: string
    groups: {
      work: string
      smartViews: string
      storage: string
    }
    items: {
      inbox: string
      needsAction: string
      waiting: string
      done: string
      scheduled: string
      opportunities: string
      closed: string
      archived: string
      trash: string
    }
  }
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
    /** CTA that clears `User.locale` so the UI follows the browser language again. */
    useDeviceLanguage: string
    clearedToast: string
    updatedToast: string
    updateErrorTitle: string
    updateErrorBody: string
    workspaceUpdatedToast: string
    workspaceUpdateErrorTitle: string
    /** Read-only note for members without admin rights on the workspace control. */
    workspaceReadOnly: string
    /** Discreet hint shown when the selected locale still has pending coverage. */
    inProgressNote: string
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
 * Clients surface — the full /clientes journey (list, detail, form).
 *
 * Noun convention: every entity noun is interpolation DATA from the
 * vocabulary resolver, passed LOWERCASE by callers (compose with
 * `lowercase: true`); each locale file capitalizes internally where its
 * grammar needs it. Sentence STRUCTURE lives here; nouns never do.
 * `nouns` are the locale-generic fallbacks used when the workspace/vertical
 * declares no explicit noun (mirrors the nav.* fallback role, singular forms
 * included). Full-phrase typed functions are used wherever word order or
 * agreement changes between languages — no `${action} ${entity}` gluing.
 * Known limitation (documented): Spanish articles/adjectives agree with the
 * standard masculine nouns; a feminine workspace override (e.g. "Clienta")
 * keeps the standard structure words.
 */
export interface ClientsMessages {
  nouns: {
    client: string
    clients: string
    project: string
    projects: string
    invoices: string
  }
  status: {
    active: string
    inactive: string
    prospect: string
  }
  list: {
    eyebrow: string
    newButton: (v: { client: string }) => string
    searchPlaceholder: (v: { clients: string }) => string
    sectionAll: (v: { clients: string }) => string
    count: (count: number, v: { client: string; clients: string }) => string
    statusFilterLabel: string
    filters: { all: string; active: string; inactive: string; prospect: string }
    stats: {
      total: string
      activeSub: string
      prospects: string
      prospectsSub: string
      inactiveSub: string
    }
    columns: { company: string; contact: string; status: string; updated: string }
    rowActionsAria: (v: { client: string }) => string
    rowView: (v: { client: string }) => string
    view: string
    updated: (date: string) => string
    loadError: (v: { clients: string }) => string
    empty: {
      title: (v: { clients: string }) => string
      bodyDefault: (v: { client: string }) => string
      bodyFiltered: string
    }
  }
  detail: {
    breadcrumbRoot: string
    tabs: { summary: string; activity: string }
    snapshot: {
      activeProjects: (v: { projects: string }) => string
      billedRevenue: string
      outstandingInvoices: (v: { invoices: string }) => string
      clientSince: (v: { client: string }) => string
    }
    profile: (v: { client: string }) => string
    company: string
    noNotes: string
    projectsSection: (v: { client: string; projects: string }) => string
    projectsEmptyTitle: (v: { client: string; projects: string }) => string
    projectsEmptyBody: (v: { client: string; projects: string }) => string
    newProject: (v: { project: string }) => string
    invoicesSection: (v: { client: string; invoices: string }) => string
    invoicesEmptyTitle: (v: { client: string; invoices: string }) => string
    invoicesEmptyBody: (v: { client: string }) => string
    openBilling: (v: { invoices: string }) => string
    due: (date: string) => string
    invoiceColumns: { amount: string; dueDate: string; status: string }
    notesSection: string
    notesEmptyTitle: string
    notesEmptyBody: (v: { client: string }) => string
    activitySection: string
    activityEmptyTitle: string
    activityEmptyBody: (v: { client: string }) => string
    activityFallback: { created: string; updated: string; system: string; note: string }
    viewBilling: (v: { invoices: string }) => string
    errors: {
      invalidId: (v: { client: string }) => string
      notFound: (v: { client: string }) => string
      backToList: (v: { clients: string }) => string
    }
  }
  form: {
    titleNew: (v: { client: string }) => string
    titleEdit: (v: { client: string }) => string
    identityTitle: (v: { client: string }) => string
    identityDesc: (v: { client: string }) => string
    contactTitle: string
    contactDesc: (v: { client: string }) => string
    billingTitle: string
    billingDesc: (v: { client: string }) => string
    notesTitle: string
    notesDesc: string
    fields: {
      id: (v: { client: string }) => string
      idAuto: string
      name: string
      namePlaceholder: (v: { client: string }) => string
      company: string
      companyPlaceholder: string
      status: string
      email: string
      emailPlaceholder: string
      phone: string
      phonePlaceholder: string
      paymentMethod: string
      currency: string
      notesPlaceholder: (v: { client: string }) => string
    }
    payment: { cash: string; transfer: string; card: string }
    saving: string
    create: (v: { client: string }) => string
    update: (v: { client: string }) => string
    toastCreated: (v: { client: string }) => string
    toastUpdated: (v: { client: string }) => string
    toastSaveError: (v: { client: string }) => string
    nameRequired: string
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

/**
 * Ask Finesse voice surface — visible labels only; no voice behavior lives
 * here. States must never rely on color alone, so every state has a label.
 */
export interface VoiceMessages {
  micStart: string
  micUnsupported: string
  stop: string
  interrupt: string
  mute: string
  unmute: string
  states: {
    connecting: string
    listening: string
    thinking: string
    speaking: string
    interrupted: string
    stopping: string
    expired: string
    error: string
  }
  micBlocked: string
  micUnavailableDevice: string
  unavailable: string
  rateLimited: string
  sessionEnded: string
  contextChanged: string
  interruptedMarker: string
  holdToTalk: string
  voiceStatusRegion: string
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
  voice: VoiceMessages
}

/** Union of valid namespace keys. */
export type UINamespace = keyof UIMessages

/**
 * Per-locale catalog contribution (§9, P4.CORE-5L): a locale file exports
 * ONLY the namespaces it really translates — each one COMPLETE against its
 * contract (partial objects inside a namespace are a type error). Missing
 * namespaces fall back to English at composition time in `ui/index.ts`, so
 * `getUIMessages` always returns a full `UIMessages` and components never
 * check for missing keys. No English copies inside locale files.
 */
export type LocaleCatalogOverrides = {
  [K in UINamespace]?: UIMessages[K]
}
