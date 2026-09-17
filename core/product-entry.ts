export type EntryProductKey = "finesse"

export interface EntryProductDefinition {
  key: EntryProductKey
  visibleName: string
  managedDomain: string
  verticalKey: string
  selfServe: boolean
  defaultUserRole: "admin" | "editor" | "viewer"
  onboardingPath: string
  homePath: string
  themeKey: string
}

export const ENTRY_PRODUCT_COOKIE = "7f-entry-product"

const ENTRY_PRODUCTS: readonly EntryProductDefinition[] = [
  {
    key: "finesse",
    visibleName: "Finesse",
    managedDomain: "getfinesse.app",
    verticalKey: "beauty",
    selfServe: true,
    defaultUserRole: "admin",
    onboardingPath: "/onboarding/finesse",
    homePath: "/today",
    themeKey: "petrol-pearl",
  },
]

export function normalizeRequestHost(host: string | null | undefined): string {
  let normalized = (host ?? "").trim().toLowerCase()
  normalized = normalized.replace(/\.$/, "")
  normalized = normalized.replace(/:\d+$/, "")
  return normalized.replace(/\.$/, "")
}

export function getEntryProductByKey(key: string | null | undefined): EntryProductDefinition | null {
  if (!key) return null
  return ENTRY_PRODUCTS.find((product) => product.key === key) ?? null
}

export function resolveEntryProductFromHost(host: string | null | undefined): EntryProductDefinition | null {
  const hostname = normalizeRequestHost(host)
  if (!hostname) return null

  return (
    ENTRY_PRODUCTS.find(
      (product) =>
        hostname === product.managedDomain || hostname.endsWith(`.${product.managedDomain}`),
    ) ?? null
  )
}

export type EntryOnboardingStatus = "not_started" | "in_progress" | "completed"

export interface EntryOnboardingState {
  product: EntryProductKey
  status: EntryOnboardingStatus
  entrySource: "direct" | "sevenf" | "invite"
  createdAt: string
  completedAt?: string
}

export function buildInitialEntryWorkspaceConfig(
  product: EntryProductDefinition,
  entrySource: EntryOnboardingState["entrySource"] = "direct",
): string {
  return JSON.stringify({
    onboarding: {
      product: product.key,
      status: "not_started",
      entrySource,
      createdAt: new Date().toISOString(),
    } satisfies EntryOnboardingState,
  })
}

export function requiresEntryOnboarding(
  config: string | null | undefined,
  productKey: EntryProductKey,
): boolean {
  if (!config) return false
  try {
    const parsed = JSON.parse(config) as { onboarding?: Partial<EntryOnboardingState> }
    const onboarding = parsed.onboarding
    if (!onboarding || onboarding.product !== productKey) return false
    return onboarding.status !== "completed"
  } catch {
    return false
  }
}
