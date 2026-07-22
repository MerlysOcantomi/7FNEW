// English base strings for the "clients" namespace.
//
// Scaffolding only (PR-I18N-2): not yet consumed. Business nouns (Client /
// Clienta / Patient) stay in the vocabulary resolver (core/personalization) and
// are interpolated in, NOT translation keys. See
// docs/i18n-localization-architecture.md §5 (composition rule), §10.

export interface ClientsNamespace {
  title: string
  newButton: string
  /** `clientPlural` is supplied by the vocabulary resolver, lowercased. */
  searchPlaceholder: (args: { clientPlural: string }) => string
  count: (count: number, clientPlural: string) => string
  empty: {
    title: string
    body: string
  }
}

export const clients: ClientsNamespace = {
  title: "Clients",
  newButton: "New client",
  searchPlaceholder: ({ clientPlural }) => `Search ${clientPlural}, company, or email…`,
  count: (count, clientPlural) => `${count} ${clientPlural}`,
  empty: {
    title: "No clients yet",
    body: "Add your first client to get started.",
  },
}
