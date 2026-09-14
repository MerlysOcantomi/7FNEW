import type { OperationDefinition, PrivilegedOperationId } from "./types"

/**
 * The operation registry. Deterministic: a fixed, ordered list; lookups
 * never depend on runtime state. Adding an operation = adding one entry.
 */
const DEFINITIONS: readonly OperationDefinition[] = [
  {
    id: "database.write",
    family: "database",
    description: "Any statement that changes application data (create/update/upsert/delete, raw writes, transactions carrying writes).",
    deniedInModes: ["freeze-writes"],
  },
  {
    id: "background.start",
    family: "background",
    description: "Starting new fire-and-forget work that may write (post-ingest notifications, intelligence, short-intent persistence).",
    deniedInModes: ["freeze-writes"],
  },
]

const BY_ID: ReadonlyMap<PrivilegedOperationId, OperationDefinition> = new Map(DEFINITIONS.map((d) => [d.id, d]))

export function listOperations(): readonly OperationDefinition[] {
  return DEFINITIONS
}

export function getOperation(id: PrivilegedOperationId): OperationDefinition {
  const definition = BY_ID.get(id)
  if (!definition) throw new Error(`privileged-operations: unknown operation ${JSON.stringify(id)}`)
  return definition
}

export function isPrivilegedOperationId(value: unknown): value is PrivilegedOperationId {
  return typeof value === "string" && BY_ID.has(value as PrivilegedOperationId)
}
