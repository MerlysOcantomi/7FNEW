import type { ClientsMessages } from "../types"

/**
 * English source for the `clients` UI namespace.
 * Business nouns (Client / Clienta / Patient) are interpolated in from the
 * vocabulary resolver — the catalog owns the sentence, never the noun.
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
