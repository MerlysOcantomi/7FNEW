// English base strings for the "billing" namespace.
//
// Scaffolding only (PR-I18N-2): visible labels for a future PR. No Finance
// redesign or behavior change. See docs/i18n-localization-architecture.md §11.

export interface BillingNamespace {
  title: string
  newInvoice: string
  empty: string
}

export const billing: BillingNamespace = {
  title: "Billing",
  newInvoice: "New invoice",
  empty: "No invoices yet.",
}
