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
  /** Top-bar notifications bell + panel chrome (shared shell). */
  notifications: {
    label: string
    newCount: (count: number) => string
    markAllRead: string
    empty: string
    viewAll: string
  }
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
  /** Global toolbar: Agents trigger label (and mobile aria-label). */
  agents: string
  /** Global toolbar: accessible name of the desktop Agents trigger. */
  agentsOpen: string
  /** Global toolbar: Ask Fanny trigger label — "Fanny" is a proper name. */
  askFanny: string
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
      /** Entry for the business identity editor at `/business-profile`. */
      businessProfile: { label: string; description: string }
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

/** Today surface — header, empty state, global-chrome frame and workboard. */
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
  /**
   * The work-first daily workboard — the production Today for every vertical
   * (including real Finesse workspaces). Counted phrases are typed functions;
   * lane/section labels are structural copy, not entity nouns.
   */
  workboard: {
    loadingAria: string
    errorNote: string
    toasts: { sendToAiFailed: string; takeOverFailed: string; tryAgain: string }
    summary: {
      overdue: (count: number) => string
      dueToday: (count: number) => string
      waiting: (count: number) => string
      caption: string
    }
    pills: { myWork: string; aiWork: string; schedule: string; waiting: string }
    lanes: {
      myWork: { title: string; subtitle: string; emptyTitle: string; emptyDescription: string }
      aiWork: {
        title: string
        subtitle: string
        emptyTitle: string
        emptyDescription: string
        emptyActionLabel: string
      }
      schedule: { title: string; subtitle: string; emptyTitle: string; emptyDescription: string }
    }
    sections: { overdue: string; dueToday: string; waitingBlocked: string; noDate: string }
    briefingAria: string
    emptyState: { title: string; body: string; inboxCta: string }
    row: {
      sendToAi: string
      takeOver: string
      proposed: string
      proposedByAi: string
      assignedToMe: string
      taskChip: string
      fromInbox: string
      fromProject: (name: string) => string
      projectFallback: string
      fromCalendar: string
      eventAria: string
      atTime: (time: string) => string
      priorities: { critical: string; high: string; low: string; normal: string }
      due: {
        todayAt: (time: string) => string
        yesterday: string
        tomorrow: string
        daysAgo: (days: number) => string
      }
      a11y: {
        task: string
        priorityPrefix: string
        duePrefix: string
        noDueDate: string
        inMyLane: string
        inAiLane: string
        fromInbox: string
        fromProject: (name: string) => string
        manualTask: string
      }
    }
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

/**
 * Calendar surface — the full /calendario journey (shell, views, navigator,
 * lenses, Intelligence Panel, EventDNA). Visible labels only; no calendar
 * behavior lives here. Counted/parametrized phrases are typed FUNCTIONS.
 * `types`/`eventTypes` are display labels for PERSISTED enum values — the
 * stored values (tarea/reunion/…) never change, only their visible labels.
 * `timeIntelligence` is a product-brand string — locales MAY keep it as-is.
 * Date/number RENDERING (month/weekday names, times) is not in this catalog:
 * it derives from Intl via `toIntlLocale` in the components.
 */
export interface CalendarMessages {
  /** Surface name — eyebrow + breadcrumb ("Calendar" / "Agenda"). */
  title: string
  /** Product-brand framing badge — same string in every locale is OK. */
  timeIntelligence: string
  today: string
  views: { day: string; week: string; month: string }
  subtitles: { day: string; week: string; month: string }
  nav: {
    openNavigatorAria: string
    navigatorTitle: string
    previousAria: string
    nextAria: string
  }
  ledger: {
    scope: string
    scheduled: string
    timeRisks: (count: number) => string
    thisMonth: string
    weekScope: (week: number) => string
    thisDay: string
  }
  lenses: {
    heading: string
    comingSoon: string
    notTracked: string
    clearAria: string
    shown: (count: number) => string
    /** Keyed camelCase per lens (`this-day` → `thisDay`, mapped in lenses.ts). */
    labels: {
      thisDay: string
      nextDays: string
      planningHorizon: string
      timeConflicts: string
      pastEvents: string
      campaignCycles: string
      followUpMoments: string
      prepWindows: string
    }
  }
  panel: {
    emptyTitle: string
    emptyBody: string
    openTimeHint: string
    dayCountHint: (count: number) => string
    lensHint: (label: string, count: number) => string
    analyzing: string
    timingInsight: string
    aiError: string
    clearSelectionAria: string
    showDetails: string
  }
  dna: {
    client: string
    project: string
    amount: string
    context: string
    when: string
    allDay: string
    meaning: {
      today: string
      tomorrow: string
      yesterday: string
      inDays: (days: number) => string
      agoDays: (days: number) => string
      inWeeks: (weeks: number) => string
      agoWeeks: (weeks: number) => string
    }
    risks: {
      overdue: string
      daysPastDue: (days: number) => string
      conflict: string
      overlaps: string
      happeningToday: string
      dueToday: string
      onTrack: string
    }
    cta: {
      goToDate: string
      viewConflict: string
      openInToday: string
      openInTasks: string
      openInFinance: string
    }
  }
  dayView: {
    emptyTitle: string
    emptyBody: string
    viewWeek: string
    openTasks: string
    allDayDeadlines: string
  }
  weekView: { empty: string }
  monthView: { plusMore: (count: number) => string }
  miniMonth: { wk: string; prevMonthAria: string; nextMonthAria: string }
  panelModes: {
    heading: string
    ariaLabel: (label: string) => string
    labels: { docked: string; compact: string; overlay: string; expanded: string; collapsed: string }
    titles: { docked: string; compact: string; overlay: string; expanded: string; collapsed: string }
  }
  /** Display labels for the persisted CalendarItemType values. */
  types: { tarea: string; proyecto: string; factura: string; evento: string }
  /** Display labels for the persisted evento `tipo` values. */
  eventTypes: { reunion: string; entrega: string; llamada: string; cita: string; evento: string }
  invoiceTitle: (numero: string | number) => string
}

/**
 * Billing surface — the full /facturacion journey (list, detail, invoice
 * form). Visible labels only; no finance behavior lives here.
 *
 * Status VALUE labels (pagada/enviada/vencida/…) resolve through the shared
 * `statuses` namespace via `resolveStatusLabel` — never duplicated here.
 * Money/date strings arrive PRE-FORMATTED from `@core/i18n/format` as
 * interpolation data; this catalog only owns sentence structure. Counted
 * phrases are typed FUNCTIONS — components never glue plurals.
 */
export interface BillingMessages {
  title: string
  newInvoice: string
  empty: string
  /** Page eyebrow + breadcrumb root ("Revenue" / "Ingresos"). */
  eyebrow: string
  /** Surface title + breadcrumb ("Invoices" / "Facturas"). */
  invoices: string
  list: {
    stats: {
      totalBilled: string
      allInvoices: string
      collected: string
      paidCount: (count: number) => string
      pending: string
      pendingCount: (count: number) => string
      overdue: string
      overdueCount: (count: number) => string
      noOverdue: string
    }
    overdueBanner: {
      title: string
      /** Full sentence — amount/date arrive pre-formatted for the locale. */
      body: (v: { numero: string; client: string; amount: string; date: string }) => string
      clientFallback: string
      viewInvoice: string
    }
    searchPlaceholder: string
    filters: { all: string; statusFallback: string; clientFallback: string }
    heading: string
    count: (count: number) => string
    loadErrorNote: string
    empty: { title: string; filtered: string; default: string }
    columns: {
      invoice: string
      client: string
      project: string
      amount: string
      issued: string
      due: string
      status: string
    }
    view: string
    issuedOn: (date: string) => string
    dueOn: (date: string) => string
  }
  detail: {
    invoiceTitle: (numero: string) => string
    downloadPdf: string
    sendByEmail: string
    markAsPaid: string
    toasts: { markedPaid: string; updateError: string }
    errors: { notFound: string; notFoundBody: string; backToBilling: string }
    tabs: {
      summary: string
      lines: string
      payments: string
      files: string
      notes: string
      activity: string
    }
    overdueAlert: {
      title: string
      body: (v: { date: string; client: string }) => string
      clientFallback: string
    }
    summary: {
      breakdown: string
      subtotal: string
      taxes: string
      total: string
      collectionStatus: string
      collectedPct: (pct: number) => string
      outstanding: (amount: string) => string
      paid: (amount: string) => string
      status: string
      client: string
      project: string
      issueDate: string
      dueDate: string
      paymentDate: string
    }
    lines: {
      heading: string
      emptyTitle: string
      emptyBody: string
      columns: { concept: string; quantity: string; unitPrice: string; total: string }
      totalDue: string
    }
    payments: {
      heading: string
      emptyTitle: string
      emptyOverdueBody: string
      emptyPendingBody: string
      fullPayment: string
      columns: { date: string; method: string; amount: string }
      summaryHeading: string
      totalIssued: string
      totalCollected: string
    }
    files: {
      heading: string
      emptyTitle: string
      emptyBody: string
      upload: string
      uploading: string
      download: string
      toasts: { uploaded: string; uploadError: string }
    }
    notes: {
      heading: string
      visibilityNote: string
      placeholder: string
      save: string
      saving: string
      previous: string
      empty: string
      userFallback: string
      toasts: { added: string; saveError: string }
    }
    activity: {
      heading: string
      emptyTitle: string
      emptyBody: string
      onlyCommentsTitle: string
      onlyCommentsBody: string
      /** Display labels for the persisted activity `type` values. */
      types: { created: string; comment: string; updated: string; deleted: string; statusChange: string }
      createdDesc: (label: string) => string
      deletedDesc: string
      statusChangeDesc: (from: string, to: string) => string
      systemFallback: string
    }
  }
  form: {
    titleNew: string
    titleEdit: string
    fields: {
      number: string
      status: string
      taxPct: string
      client: string
      project: string
      issueDate: string
      dueDate: string
    }
    /** Sample document id — identical across locales. */
    numberPlaceholder: string
    noClient: string
    noProject: string
    lineItems: string
    addItem: string
    descriptionPlaceholder: string
    qtyPlaceholder: string
    pricePlaceholder: string
    removeItemAria: string
    subtotal: string
    taxWithPct: (pct: number) => string
    total: string
    saving: string
    create: string
    update: string
    errors: { numberRequired: string; lineRequired: string }
    toasts: { created: string; updated: string; saveError: string }
  }
}

/**
 * Services surface — the /services catalog editor (same page for every
 * vertical; verticals only contribute seeds/labels via their pack).
 * Counted phrases are typed FUNCTIONS.
 */
export interface ServicesMessages {
  title: string
  description: string
  loading: { description: string; body: string }
  add: {
    heading: string
    namePlaceholder: string
    categoryOptionalPlaceholder: string
    button: string
  }
  list: {
    empty: string
    /** "3 services · 2 active" — one phrase, both counts. */
    counts: (total: number, active: number) => string
    categoryPlaceholder: string
    active: string
    inactive: string
    removeAria: (name: string) => string
  }
  save: { button: string; saving: string; saved: string }
  errors: { load: string; save: string }
}

/**
 * Team surface — the /usuarios journey (list, cards, delete dialog, user
 * form). The surface noun is the locale's generic Team/Equipo (vocabulary
 * overrides stay in the resolver layer, never here). `roles` are display
 * labels for the persisted role VALUES (admin/gerente/miembro) — the stored
 * values never change. Status VALUE labels resolve through `statuses`.
 */
export interface TeamMessages {
  title: string
  description: string
  newUser: string
  roles: { admin: string; gerente: string; miembro: string }
  stats: { total: string; active: string; uniqueRoles: string }
  empty: { title: string; body: string }
  card: { projectsPlaceholder: string }
  deleteDialog: {
    title: string
    description: (name: string) => string
    confirm: string
  }
  toasts: { deleted: string; deleteError: string }
  form: {
    titleNew: string
    titleEdit: string
    fields: { name: string; email: string; role: string; status: string; department: string }
    namePlaceholder: string
    emailPlaceholder: string
    departmentPlaceholder: string
    errors: { nameRequired: string; emailRequired: string }
    saving: string
    create: string
    update: string
    toasts: { created: string; updated: string; saveError: string }
  }
}

/**
 * Smart Inbox MAIN SHELL — toolbar, conversation list (+ row + meta line),
 * thread chrome, email reading view, layout switcher, and the page-level
 * dialogs / banners / toasts of `app/inbox/page.tsx`.
 *
 * Boundary rules (single source per message):
 * - Status / urgency / channel VALUE labels, relative dates, action labels and
 *   sync toast headlines live in `lib/inbox-labels.ts` — never duplicated here.
 *   This namespace owns only the shell chrome AROUND those labels.
 * - Stage 2 added `composer` (reply composer) and `panel` (right context
 *   panel) sub-groups; both follow the same rules as the shell.
 * - Channel/product names (WhatsApp, Instagram, Email-as-product, Fanny,
 *   Smart Inbox) are brands: identical across locales but still sourced from
 *   the catalog wherever they appear as UI copy.
 * - Counted phrases are typed FUNCTIONS — components never glue plurals.
 */
export interface InboxMessages {
  /** Tooltip/aria phrase for a channel badge or chip ("Channel: WhatsApp"). */
  channelTitle: (label: string) => string
  toolbar: {
    compose: string
    /** title + aria for the compose button ("Compose new message"). */
    composeTitle: string
    capture: string
    captureTitle: string
    captureAria: string
    workFilterAria: string
    /**
     * Labels for primary-filter chips. Core row uses the first four; the
     * rest cover registry filters a vertical/workspace may promote into the
     * chip row (`core/inbox/filter-registry.ts` labelKeys).
     */
    workFilters: {
      all: string
      needsAttention: string
      waiting: string
      done: string
      unanswered: string
      urgent: string
      unassigned: string
      opportunities: string
      closed: string
      archived: string
      trash: string
    }
    /** Collapsed channel-picker trigger prefix ("Channel:"). */
    channelPrefix: string
    channelsHeading: string
    closeChannelPicker: string
    allChannels: string
    /** Suffix for planned channels rendered as disabled options ("Coming soon"). */
    channelComingSoon: string
    allStatuses: string
    moreFilters: string
    /** Tiny badge shown when an advanced filter is active ("on"). */
    filtersOnBadge: string
    priorityLabel: string
    priorityFilterAria: string
    priorityFilterTitle: string
    priorities: { any: string; critical: string; high: string; medium: string; low: string }
    assignmentLabel: string
    assignmentFilterAria: string
    assignmentFilterTitle: string
    assignments: { anyone: string; mine: string; unassigned: string }
    conversationStatusLabel: string
    conversationStatusAria: string
    conversationStatusTitle: string
    filterPlaceholder: string
    filterAria: string
    clearFilter: string
    filteringTitle: (term: string) => string
    actionsAria: string
    syncNow: string
    syncing: string
    lastSynced: (age: string) => string
    /** Compact sync-age phrases composed into `lastSynced` ("5m ago"). */
    syncAge: {
      justNow: string
      minutesAgo: (minutes: number) => string
      hoursAgo: (hours: number) => string
      daysAgo: (days: number) => string
    }
  }
  list: {
    unavailableTitle: string
    empty: {
      noResultsTitle: string
      noResultsBody: (term: string) => string
      mineTitle: string
      mineBody: string
      unassignedTitle: string
      unassignedBody: string
      defaultTitle: string
      defaultBody: string
    }
    loadingMore: string
    loadMore: string
    item: {
      showDetails: string
      hideDetails: string
      unread: string
      /** aria-label for the message-count figure on a row. */
      messageCount: (count: number) => string
      urgencyTitle: (label: string) => string
      loadingRequests: string
      earlierRequests: string
      openMessage: (text: string) => string
      noEarlierRequests: string
    }
    /** Chip cluster labels (currently rendered by ConversationMetaLine). */
    meta: {
      pendingDecisions: (count: number) => string
      pendingDecisionsTitle: string
      lead: (score: number) => string
      categoryTitle: (category: string) => string
      smartAction: {
        failed: { label: string; title: string }
        needsReview: { label: string; title: string }
        draftReady: { label: string; title: string }
        actionReady: { label: string; title: string }
        taskCreated: { label: string; title: string }
      }
    }
  }
  thread: {
    emptyTitle: string
    emptyBody: string
    viewToggleAria: string
    chat: string
    /** Email view-mode label — brand/product noun, same in every locale. */
    email: string
    emailNavAria: string
    previousEmail: string
    nextEmail: string
    emailPosition: (current: number, total: number) => string
    emailsCount: (count: number) => string
    /** Mobile back button — returns to the conversation list. */
    back: string
    context: string
    statusPrefix: string
    statusSelectAria: string
    loadErrorTitle: string
    loading: string
    noMessages: string
    /** Divider labels between stacked emails in chat view. */
    separator: { reply: string; email: string }
  }
  emailView: {
    noEmailsTitle: string
    noEmailsBody: string
    noSubject: string
    trashedPlaceholder: string
    restore: string
    restoreAria: string
    trashMessage: string
    from: string
    to: string
    cc: string
    bcc: string
    date: string
    attachments: (count: number) => string
  }
  layout: {
    switcherAria: string
    brief: { label: string; title: string }
    read: { label: string; title: string }
    handle: { label: string; title: string }
  }
  /** Thread message chrome labels derived in `app/inbox/page.tsx`. */
  message: {
    internalNote: string
    team: string
    contact: string
    unidentifiedContact: string
    conversationFallback: string
    internalNoteMeta: string
    inbound: string
    system: string
    sent: string
    sendFailed: string
    confirmedReceived: (when: string) => string
    opened: (when: string) => string
    possiblyOpened: (when: string) => string
    unknownAssignee: string
  }
  errors: {
    listWorkspaceUnavailable: string
    listLoadFailed: string
    detailWorkspaceUnavailable: string
    detailLoadFailed: string
  }
  banners: {
    loadFailedTitle: string
    loadFailedBody: string
    retry: string
    dismissFetchFeedback: string
    goToInbox: string
    terminalRescueLead: string
    terminalRescueBody: string
    trashOnly: string
    /** Page-local sync detail lines (headlines stay in lib/inbox-labels). */
    sync: {
      noConnectionHint: string
      skippedKnown: (count: number) => string
      checkedAllKnown: (count: number) => string
      andMore: (count: number) => string
    }
  }
  toasts: {
    noConversationSelected: string
    creatingEvent: string
    eventCreated: string
    eventAlreadyCreated: string
    couldNotApproveCalendarAction: string
    couldNotCreateEvent: string
    processing: string
    actionFailed: string
    actionApplied: string
    unknownError: string
    approving: string
    executing: string
    actionApprovedAndExecuted: string
    couldNotApproveAction: string
    couldNotExecuteAction: string
    processingAction: string
    couldNotPerformAction: string
    actionApproved: string
    actionDismissed: string
    actionExecuted: string
    handoffUpdated: string
    savingHandoff: string
    couldNotSaveHandoff: string
    couldNotSaveDraft: string
    couldNotSendMessage: string
    noteSaved: string
    replySavedEmailFailed: (reason: string) => string
    replyFailedUnknownReason: string
    replySentEmailDelivered: string
    replySent: string
    uploadFailed: string
    uploadFailedFile: (filename: string) => string
    filesFailed: (count: number, firstError: string) => string
    couldNotAssign: string
    couldNotUpdateStatus: string
    couldNotUpdateMessageStatus: string
    couldNotMarkAsDone: string
    couldNotUpdateMessageTrash: string
    couldNotMoveToTrash: string
    couldNotConvertPendingItem: string
    todoCreatedFromPendingItem: string
    couldNotResolveMessageForTodo: string
    messageFollowUp: string
    couldNotCreateTodoFromMessage: string
    todoCreatedFromSelectedMessage: string
    todoCreatedFromLatestMessage: string
    couldNotCreateTodoFromInternalNote: string
    todoCreatedFromInternalNote: string
  }
  dialogs: {
    assign: {
      title: string
      description: string
      chooseMember: string
      userIdPlaceholder: string
      confirm: string
    }
    dismiss: {
      title: string
      description: string
      reasonPlaceholder: string
      confirm: string
    }
    compose: {
      title: string
      description: string
      to: string
      subject: string
      subjectPlaceholder: string
      message: string
      messagePlaceholder: string
      send: string
      sending: string
    }
  }
  todoSuggestion: {
    createFromNote: string
    createTodo: string
    dismissAria: string
  }
  contextSheet: {
    fallbackTitle: string
    description: string
  }
  contextPlaceholder: string
  /**
   * Reply composer (components/inbox/reply-composer.tsx) — stage 2.
   * Visible chrome only: mode/toolbar labels, AI assist panel, attach
   * toolbox, More menu, email details fields, voice states and assist
   * error feedback. Channel VALUE labels stay in `lib/inbox-labels.ts`.
   */
  composer: {
    internalNoteBanner: string
    /** Send button hover title — the action label plus the keyboard shortcut. */
    sendTitle: (label: string) => string
    send: {
      saveNote: string
      forward: string
      replyAll: string
      sendReply: string
      sendMessage: string
    }
    placeholders: {
      voiceCompose: string
      internalNote: string
      emailReply: string
      chatMessage: string
      defaultMessage: string
    }
    /** Subject preview fallback when the email thread has no subject. */
    noSubject: string
    undoAiChange: string
    processing: { composing: string; rewriting: string }
    voice: {
      listeningIntent: string
      done: string
      stopDictation: string
      recording: string
      stopRecording: string
      dictate: string
      dictateTitle: string
      speakIntent: string
      speakIntentTitle: string
      intentTooShort: string
    }
    removeAttachment: string
    /** Context chip ("Regarding · this message / whole conversation"). */
    regarding: { label: string; thisMessage: string; wholeConversation: string }
    toolbar: {
      reply: string
      replyAll: string
      forward: string
      internalNote: string
      switchBackToReply: string
      emailDetails: string
      details: string
      emailDetailsTitle: string
      detailsTitle: string
      attach: string
      aiTools: string
      aiToolsTitle: string
      more: string
      moreTitle: string
    }
    details: {
      signedInAs: string
      confirmationRequested: string
      confirmationRequestedTitle: string
      confirmationRequestedAria: string
      subject: string
      to: string
      cc: string
      bcc: string
      recipientPlaceholder: string
      ccPlaceholder: string
      bccPlaceholder: string
    }
    /** Channel badge fallback when the channel slug is unknown/empty. */
    channelFallback: string
    assist: {
      tablistAria: string
      emptyHint: string
      tabs: {
        improve: string
        translate: string
        templates: string
        suggestions: string
        voice: string
      }
      /** AI improve tone chips (SMART_TOOLS). */
      tones: {
        proofread: string
        shorter: string
        clearer: string
        professional: string
        warmer: string
        direct: string
      }
      templateSearchPlaceholder: string
      noMatches: string
      fannyTitled: (title: string) => string
      fannySuggestedReply: string
      editSuggestionPlaceholder: string
      useReply: string
      errors: {
        processFailed: string
        connectionUnchanged: string
        translateFailed: string
        connectionTranslate: string
      }
    }
    attach: {
      tablistAria: string
      tabs: { attach: string; share: string }
      file: string
      fileTitle: string
      image: string
      imageTitle: string
      document: string
      documentTitle: string
      insertLink: string
      insertLinkTitle: string
      urlLabel: string
      linkLabelOptional: string
      linkLabelPlaceholder: string
      insert: string
      confirmReceived: string
      confirmationRequested: string
      confirmReceivedTitle: string
      confirmationRequestedTitle: string
    }
    more: {
      contextHeading: string
      contextCaption: string
      useLatestMessage: string
      useWholeConversation: string
      advancedActions: string
      thisMessageHeading: string
      latestMessageHeading: string
      manualFallbackCaption: string
      markMessageNeedsAction: string
      markMessageDone: string
      markedDone: string
      addInternalNote: string
      createFollowUp: string
      conversationHeading: string
      conversationCaption: string
      markNeedsAction: string
      markResolved: string
      resolved: string
      unarchive: string
      archive: string
      archived: string
      reopen: string
      close: string
      closed: string
      alreadyTitle: (label: string) => string
      alreadyApplied: (label: string) => string
    }
  }
  /**
   * Right context panel (components/inbox/context-panel.tsx) — stage 2.
   * Action-type VALUE labels stay in `lib/inbox-labels.ts`; only the
   * panel's own chrome, guidance sentences and CTA labels live here.
   */
  panel: {
    header: { title: string; messageInsight: string; conversationOverview: string }
    handling: {
      aria: string
      assignedToMe: string
      assignedTo: (name: string) => string
      assigned: string
      unassigned: string
      waitingOnClient: string
      done: string
      needsReview: string
    }
    unknownContact: string
    contact: {
      details: string
      showDetails: string
      hideDetails: string
      clientProfileLinked: string
      noClientProfile: string
      viewClientProfile: string
      relationship: {
        client: string
        lead: string
        supplier: string
        colleague: string
        visitor: string
        contact: string
      }
    }
    triage: {
      messageType: string
      priority: string
      opportunity: string
      language: string
      opportunityHigh: string
      opportunityModerate: string
      leadScoreTitle: (score: number) => string
      priorityAria: (label: string) => string
      priorities: { critical: string; high: string; medium: string; low: string; normal: string }
    }
    confidenceTitle: string
    confidenceAria: (pct: number) => string
    summaryLabel: string
    summaryPlaceholder: string
    keyFacts: string
    decisions: string
    counters: {
      draftsOpen: (count: number) => string
      actionsOpen: (count: number) => string
    }
    request: {
      label: string
      notSummarised: string
      hasAttachments: string
      hasLink: string
      direction: {
        inbound: string
        outbound: string
        internal: string
        system: string
        fallback: string
      }
    }
    attention: {
      label: string
      tone: string
      negativeUrgent: string
      negative: string
      positiveUrgent: string
      positiveOpportunity: string
      positive: string
      urgent: string
    }
    recommends: {
      label: string
      editPlaceholder: string
      fallbackAskMissing: string
      fallbackReview: string
      fallbackPreparing: string
    }
    actions: {
      label: string
      reviewDraft: string
      reviewDraftDescription: string
      addToCalendar: string
      eventDetected: (title: string) => string
      eventDetectedGeneric: string
      forThisMessage: string
      anchoredTitle: string
      continue: string
      /** Business CTA labels per action type (richer than `actionTypeLabel`). */
      labels: {
        createClient: string
        createProject: string
        createTask: string
        scheduleFollowup: string
        assignOperator: string
        generateProposal: string
        createEvent: string
      }
      /** One-line per-type fallback descriptions of what the action does. */
      descriptions: {
        createClient: string
        createProject: string
        createTask: string
        scheduleFollowup: string
        assignOperator: string
        generateProposal: string
        createEvent: string
      }
    }
    pendingDecisions: {
      label: string
      caption: string
      priorities: { low: string; normal: string; high: string; urgent: string }
      confidencePct: (pct: number) => string
      confidenceTitle: string
      viewOnly: string
      viewOnlyTitle: string
      dismiss: string
      dismissAria: (title: string) => string
      createTask: string
      continue: string
      primaryAria: (label: string, title: string) => string
    }
    workflow: { label: string; assignPlaceholder: string; unassigned: string; updating: string }
    askFanny: { label: string; caption: string }
    calendar: {
      dialogAria: string
      heading: string
      reviewCaption: string
      previewOnly: string
      close: string
      fields: {
        title: string
        date: string
        time: string
        duration: string
        allDay: string
        location: string
        description: string
      }
      titlePlaceholder: string
      locationPlaceholder: string
      descriptionPlaceholder: string
      durations: { min30: string; min45: string; h1: string; h1x5: string; h2: string; h3: string }
      markAllDay: string
      missing: (fields: string) => string
      actionMissing: string
      invalidDateTime: string
      couldNotCreate: string
      creatingEventTitle: string
      createTitle: string
      creating: string
      createEvent: string
    }
  }
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
  services: ServicesMessages
  team: TeamMessages
  inbox: InboxMessages
  statuses: StatusesMessages
  voice: VoiceMessages
}

/** Union of valid namespace keys. */
/**
 * Shared status/priority labels for persisted Spanish enum VALUES (clients,
 * projects, invoices, tasks, campaigns). The stored values never change —
 * only these visible labels localize. Replaces the English-only
 * `estadoLabel`/`prioridadLabel` maps in `tools/api-client.ts` as the display
 * source (`resolveStatusLabel` in `ui/index.ts` falls back to the raw value).
 */
export interface StatusesMessages {
  estado: {
    activo: string
    inactivo: string
    prospecto: string
    planificacion: string
    en_progreso: string
    revision: string
    completado: string
    cancelado: string
    pendiente: string
    completada: string
    cancelada: string
    borrador: string
    enviada: string
    pagada: string
    vencida: string
    activa: string
    pausada: string
    en_pausa: string
  }
  prioridad: {
    baja: string
    media: string
    alta: string
    urgente: string
  }
}

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
