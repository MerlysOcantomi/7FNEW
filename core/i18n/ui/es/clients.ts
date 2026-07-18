import type { ClientsMessages } from "../types"

/**
 * Spanish source for the `clients` UI namespace.
 * P4.1 ships English values on purpose — the Clients surface does not consume
 * this namespace yet; the translation pass (composed with the Clienta/Clientas
 * vocabulary) belongs to the Finesse pilot (P4.2). Typed parity enforced.
 */
export const clients: ClientsMessages = {
  title: "Clients",
  newButton: "New client",
  searchPlaceholder: ({ clientPlural }) => `Search ${clientPlural}, company, or email…`,
  count: (count, clientPlural) => `${count} ${clientPlural}`,
  empty: {
    title: "No clients yet",
    body: "Add your first client to get started.",
  },
}
