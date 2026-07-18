import type { BillingMessages } from "../types"

/**
 * Spanish source for the `billing` UI namespace.
 * P4.1 ships English values on purpose — no surface consumes this namespace
 * yet; the translation pass (Billing vs Beauty "Cobros") belongs to the
 * Finesse pilot (P4.2). Typed parity enforced.
 */
export const billing: BillingMessages = {
  title: "Billing",
  newInvoice: "New invoice",
  empty: "No invoices yet.",
}
