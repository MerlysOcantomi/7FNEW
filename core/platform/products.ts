/**
 * FOUND-01 — Canonical product keys.
 *
 * A PRODUCT is a sellable unit of the platform (ARCH-02 §1). Keys are stable,
 * machine-readable and marketing-free: plan/package names ("Starter", …) stay
 * in `core/system/plans.ts` and never become runtime branch conditions.
 * Products are NOT experiences (shells) and NOT AI models.
 *
 * DELIBERATELY PARTIAL. Only concepts backed by ARCH-01/02/03 and the current
 * repo are typed. Not typed yet (they are entitlement-kind constructs, owned
 * by FOUND-02a): the `finesse` vertical OFFERING, the `growth.presence`
 * capability ADD-ON (today: `PresenceSubscription`), and limit add-ons.
 * Extending this catalog = appending keys; existing keys never change meaning.
 */

export const PRODUCT_KEYS = ["core", "smart_inbox", "growth", "finance"] as const
export type ProductKey = (typeof PRODUCT_KEYS)[number]

export interface ProductDefinition {
  readonly key: ProductKey
  /** Display name — separate from the stable key on purpose. */
  readonly label: string
  /**
   * `core` is the pseudo-product every valid workspace holds (ARCH-02 §3):
   * shared infrastructure, never sold and never revocable per workspace.
   */
  readonly alwaysAvailable: boolean
}

export const PRODUCT_DEFINITIONS = {
  core: { key: "core", label: "Core", alwaysAvailable: true },
  smart_inbox: { key: "smart_inbox", label: "Smart Inbox", alwaysAvailable: false },
  growth: { key: "growth", label: "Growth", alwaysAvailable: false },
  finance: { key: "finance", label: "Finance", alwaysAvailable: false },
} as const satisfies Record<ProductKey, ProductDefinition>
