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

/** Navigation labels. English-only source; not wired to the sidebar yet. */
export interface NavMessages {
  today: string
  calendar: string
  clients: string
  inbox: string
  services: string
  billing: string
  team: string
  settings: string
}

/** All UI namespaces available to `getUIMessages` / `getNamespace`. */
export interface UIMessages {
  common: CommonMessages
  nav: NavMessages
}

/** Union of valid namespace keys. */
export type UINamespace = keyof UIMessages
