/**
 * Service catalog — the generic structured list of what a business offers.
 *
 * Storage stays in Workspace.config.serviceCatalog so every vertical can reuse
 * the same contract. Finesse is the first consumer of the richer V2 fields,
 * but none of them are Beauty-specific.
 *
 * Compatibility rule: every V1 item ({ name, category, active }) still parses.
 * New fields are optional and normalized defensively so old workspaces need no
 * config migration.
 */

export interface ServiceCatalogItem {
  id: string
  name: string
  category?: string
  description?: string
  /** Planned service duration. Appointment snapshots may override it. */
  durationMinutes?: number
  /** Default public/booking price in major currency units. */
  price?: number
  /** ISO 4217 code for the default price (e.g. EUR, CHF, USD). */
  currency?: string
  /** Workspace User ids allowed to perform this service. Empty/absent = unrestricted. */
  staffUserIds?: string[]
  /** Optional preparation/turnaround windows used by scheduling. */
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  active: boolean
}

export const MAX_SERVICE_CATALOG_ITEMS = 100
export const MAX_SERVICE_STAFF = 50
export const MAX_SERVICE_DURATION_MINUTES = 24 * 60
export const MAX_SERVICE_BUFFER_MINUTES = 4 * 60

export function slugifyServiceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export function makeServiceId(name: string, usedIds: Set<string>): string {
  const base = slugifyServiceName(name) || "service"
  if (!usedIds.has(base)) return base
  let n = 2
  while (usedIds.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function coerceString(value: unknown, max = 240): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function coerceInt(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  const rounded = Math.round(n)
  if (rounded < min || rounded > max) return undefined
  return rounded
}

function coercePrice(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return undefined
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function coerceCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const code = value.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : undefined
}

function coerceStaffUserIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const id = coerceString(item, 120)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_SERVICE_STAFF) break
  }
  return out.length > 0 ? out : undefined
}

export function normalizeServiceItem(
  raw: unknown,
  usedIds: Set<string>,
): ServiceCatalogItem | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>

  const name = coerceString(obj.name, 160)
  if (!name) return null

  const rawId = coerceString(obj.id, 120)
  const id = rawId && !usedIds.has(rawId) ? rawId : makeServiceId(name, usedIds)
  usedIds.add(id)

  const category = coerceString(obj.category, 120)
  const description = coerceString(obj.description, 1000)
  const durationMinutes = coerceInt(obj.durationMinutes, 5, MAX_SERVICE_DURATION_MINUTES)
  const price = coercePrice(obj.price)
  const currency = coerceCurrency(obj.currency)
  const staffUserIds = coerceStaffUserIds(obj.staffUserIds)
  const bufferBeforeMinutes = coerceInt(obj.bufferBeforeMinutes, 0, MAX_SERVICE_BUFFER_MINUTES)
  const bufferAfterMinutes = coerceInt(obj.bufferAfterMinutes, 0, MAX_SERVICE_BUFFER_MINUTES)
  const active = obj.active === undefined ? true : obj.active !== false

  return {
    id,
    name,
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(currency ? { currency } : {}),
    ...(staffUserIds ? { staffUserIds } : {}),
    ...(bufferBeforeMinutes !== undefined ? { bufferBeforeMinutes } : {}),
    ...(bufferAfterMinutes !== undefined ? { bufferAfterMinutes } : {}),
    active,
  }
}

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

export function normalizeServiceCatalog(raw: unknown): ServiceCatalogItem[] {
  return resolveServiceCatalog(raw)
}

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

export function findServiceById(
  catalog: ServiceCatalogItem[],
  serviceId: string | null | undefined,
): ServiceCatalogItem | null {
  if (!serviceId) return null
  return catalog.find((item) => item.id === serviceId) ?? null
}
