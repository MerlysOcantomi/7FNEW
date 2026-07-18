import type { ServicesMessages } from "../types"

/**
 * English source for the `services` UI namespace — the /services catalog
 * editor (same page for every vertical). Visible labels only.
 */
export const services: ServicesMessages = {
  title: "Services",
  description:
    "The catalog of what your business offers. Your agents use the active services to understand what you sell. Only active services are shared with them.",
  loading: { description: "Loading…", body: "Loading services…" },
  add: {
    heading: "Add a service",
    namePlaceholder: "Service name…",
    categoryOptionalPlaceholder: "Category (optional)",
    button: "Add",
  },
  list: {
    empty: "No services yet. Add the first one above.",
    counts: (total, active) =>
      `${total} service${total !== 1 ? "s" : ""} · ${active} active`,
    categoryPlaceholder: "Category",
    active: "Active",
    inactive: "Inactive",
    removeAria: (name) => `Remove ${name}`,
  },
  save: { button: "Save services", saving: "Saving…", saved: "Saved" },
  errors: {
    load: "Could not load the service catalog",
    save: "Could not save the catalog",
  },
}
