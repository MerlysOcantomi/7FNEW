import { assertOperationAllowed } from "@core/privileged-operations"
import { classifyRawSql } from "@core/privileged-operations/raw-sql"

/**
 * `database.write` enforcement at the Prisma boundary (NEON-05, Privileged
 * Operations Core v1).
 *
 * Implemented as a Prisma CLIENT EXTENSION (`$extends({ query })`), the
 * mechanism Prisma 7 supports for intercepting operations — not a hand-rolled
 * Proxy over the client. Every model operation and every raw call goes
 * through `query` extensions, including operations issued on the `tx` client
 * inside `$transaction(async (tx) => …)` and the promises of the batch form
 * `$transaction([…])`, because both are derived from the extended client.
 *
 * Classification is an ALLOWLIST of read operations: anything Prisma adds
 * later that is not in the list is treated as a write (fail closed).
 *
 *   model reads   findUnique(OrThrow) findFirst(OrThrow) findMany count aggregate groupBy
 *   model writes  create createMany createManyAndReturn update updateMany
 *                 updateManyAndReturn upsert delete deleteMany (and anything unknown)
 *   raw           $executeRaw / $executeRawUnsafe → write by contract;
 *                 $queryRaw / $queryRawUnsafe → `classifyRawSql` (read only
 *                 when the statement starts with a read verb and carries no
 *                 mutating keyword anywhere).
 *
 * The guard asks the Privileged Operations core BEFORE the query is sent;
 * the refusal is a `PrivilegedOperationDeniedError` (HTTP 503 through
 * `core/api.ts`). In `normal` mode the guard is a no-op besides the check.
 */

export const READ_MODEL_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

export function isReadModelOperation(operation: string): boolean {
  return READ_MODEL_OPERATIONS.has(operation)
}

/** Extract the SQL text from the argument shapes Prisma hands to raw query extensions. */
export function rawSqlText(args: unknown): string {
  if (typeof args === "string") return args
  if (Array.isArray(args)) return typeof args[0] === "string" ? args[0] : rawSqlText(args[0])
  if (args && typeof args === "object") {
    const o = args as { sql?: unknown; strings?: unknown; text?: unknown }
    if (typeof o.sql === "string") return o.sql
    if (typeof o.text === "string") return o.text
    if (Array.isArray(o.strings)) return o.strings.join("?")
  }
  // Unknown shape: fail closed by returning something that classifies as a write.
  return ""
}

type QueryFn<A, R> = (args: A) => Promise<R>

/** Ask the core before a model operation runs. Exported for unit tests. */
export async function guardModelOperation<A, R>(operation: string, args: A, query: QueryFn<A, R>): Promise<R> {
  if (!isReadModelOperation(operation)) assertOperationAllowed("database.write")
  return query(args)
}

/** Ask the core before a raw call runs. Exported for unit tests. */
export async function guardRawOperation<A, R>(operation: string, args: A, query: QueryFn<A, R>): Promise<R> {
  const isExecute = operation === "$executeRaw" || operation === "$executeRawUnsafe"
  if (isExecute || classifyRawSql(rawSqlText(args)) === "write") assertOperationAllowed("database.write")
  return query(args)
}

/**
 * The extension definition. Typed loosely on purpose: the generated client's
 * extension types are enormous and add nothing here — the runtime contract
 * (operation name + args + query) is what matters and is unit-tested.
 */
export const writeGuardExtension = {
  name: "sevenf-privileged-operations-database-write",
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }: { operation: string; args: unknown; query: QueryFn<unknown, unknown> }) {
        return guardModelOperation(operation, args, query)
      },
    },
    async $queryRaw({ operation, args, query }: { operation: string; args: unknown; query: QueryFn<unknown, unknown> }) {
      return guardRawOperation(operation, args, query)
    },
    async $queryRawUnsafe({ operation, args, query }: { operation: string; args: unknown; query: QueryFn<unknown, unknown> }) {
      return guardRawOperation(operation, args, query)
    },
    async $executeRaw({ operation, args, query }: { operation: string; args: unknown; query: QueryFn<unknown, unknown> }) {
      return guardRawOperation(operation, args, query)
    },
    async $executeRawUnsafe({ operation, args, query }: { operation: string; args: unknown; query: QueryFn<unknown, unknown> }) {
      return guardRawOperation(operation, args, query)
    },
  },
} as const
