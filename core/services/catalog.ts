/**
 * Service catalog — the generic (core) structured list of "what a business
 * offers". This is CORE infrastructure, not a Beauty feature: every vertical
 * has services (an agency has offerings, a clinic has treatments, a salon has
 * beauty services). A vertical only contributes DATA (a seed + labels); the
 * catalog logic, storage shape and page are the same for everyone.
 *
 * Design rules honored here:
 *   - Pure and DB-free — safe on the client, on the server and in tests. No
 *     `@core/db` import (mirrors the vertical-packs + inbox pure-planner pattern).
 *   - Tolerant parse → normalized output: the persisted `serviceCatalog` may come
 *     from a vertical SEED (items shaped `{ name, category, active }`, no id) or
 *     from a workspace that already saved (items with a stable `id`). Both parse
 *     cleanly; missing ids are generated deterministically from the name.
 *   - Stored in `Workspace.config.serviceCatalog` (JSON) — no Prisma migration.
 *     `mergeConfigs` replaces the whole array, so a workspace fully OWNS its
 *     catalog once it saves; before that it sees the vertical seed.
 *
 * PR1 scope: id (stable), name, category, active. Duration, price, tags,
 * resources, staff, packages and any agenda/billing wiring are deliberately out.
 */

/** A single catalog service. `id` is stable so agenda/billing can reference it later. */
export interface ServiceCatalogItem {
  id: string
  name: string
  /** Optional grouping label (e.g. "Uñas", "Estética"). */
  category?: string
  active: boolean
}

/** Hard cap so a workspace config JSON can never grow unbounded. */
export const MAX_SERVICE_CATALOG_ITEMS = 100

/** Slug a service name into an id-safe token. Empty/non-alphanumeric → "". */
export function slugifyServiceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Espana)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/**
 * Deterministic, collision-free id from a name given the ids already in use.
 * No `Math.random`/`Date.now` — same input always yields the same id, which
 * keeps the layer testable and the persisted catalog reproducible.
 */
export function makeServiceId(name: string, usedIds: Set<string>): string {
  const base = slugifyServiceName(name) || "service"
  if (!usedIds.has(base)) return base
  let n = 2
  while (usedIds.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Normalize one raw JSON entry into a `ServiceCatalogItem`, or `null` when it
 * carries no usable name. Reuses a valid, unused `id` when present; otherwise
 * derives a stable one from the name. `active` defaults to `true` (a seed item
 * without the flag is considered offered).
 */
export function normalizeServiceItem(
  raw: unknown,
  usedIds: Set<string>,
): ServiceCatalogItem | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>

  const name = coerceString(obj.name)
  if (!name) return null

  const rawId = coerceString(obj.id)
  const id =
    rawId && !usedIds.has(rawId) ? rawId : makeServiceId(name, usedIds)
  usedIds.add(id)

  const category = coerceString(obj.category)
  const active = obj.active === undefined ? true : obj.active !== false

  return {
    id,
    name,
    ...(category ? { category } : {}),
    active,
  }
}

/**
 * Resolve a raw `serviceCatalog` value (already merged defaults+override) into a
 * clean, de-duplicated `ServiceCatalogItem[]`. Tolerant: non-arrays → `[]`,
 * unusable entries are dropped, ids are made unique. Capped at
 * `MAX_SERVICE_CATALOG_ITEMS`.
 */
export function resolveServiceCatalog(raw: unknown): ServiceCatalogItem[] {
  if (!Array.isArray(raw)) return []
  const usedIds = new Set<string>()
  const items: ServiceCatalogItem[] = []
  for (const entry of raw) {
    if (items.length >= MAX_SERVICE_CATALOG_ITEMS) break
    const item = normalizeServiceItem(entry, usedIds)
    if (item) items.push(item)
  }
  return items
}

/**
 * Normalize an incoming PUT payload into what gets persisted. Same rules as
 * `resolveServiceCatalog` — the API never trusts the client shape.
 */
export function normalizeServiceCatalog(raw: unknown): ServiceCatalogItem[] {
  return resolveServiceCatalog(raw)
}

/**
 * One-way bridge for the agent context: the names of the ACTIVE services only,
 * de-duplicated in order. Inactive services never reach `businessProfile.services`,
 * so Fanny and the other agents only ever see what the business currently offers.
 */
export function activeServiceNames(catalog: ServiceCatalogItem[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of catalog) {
    if (!item.active) continue
    const name = item.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}
