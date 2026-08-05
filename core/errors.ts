/**
 * Public API error identity (CORE-02A).
 *
 * LEAF MODULE — it must keep importing NOTHING. No database, no
 * `next/headers`, no authentication, no Prisma, no environment access, no
 * services. That is what lets `core/api.ts` depend on it from any runtime
 * (Node or Edge) without pulling a dependency graph behind it, and what makes
 * a cycle impossible: the three error classes that adopt this contract live in
 * modules that themselves import the database, and they can only import
 * *downwards* into this file.
 *
 * WHY THIS EXISTS
 * ---------------
 * `handleError` has to decide which errors are safe to publish verbatim. The
 * first attempt matched on `Error.name` being one of `"WorkspaceError"`,
 * `"RbacError"` or `"PlatformError"`, plus the presence of `code` and
 * `status`. That is not an identity check — it is a description, and every
 * part of it is trivially forgeable:
 *
 *     const spoofed = new Error("sk-REAL-SECRET")
 *     spoofed.name = "WorkspaceError"          // `name` is a writable data property
 *     Object.assign(spoofed, { code: "UNAUTHORIZED", status: 401 })
 *
 * Anything holding that error — an upstream SDK wrapping a provider response,
 * a library reflecting attacker-influenced data into an error, or our own code
 * re-throwing something opaque — could then have its message published to the
 * client under a forged status.
 *
 * THE IDENTITY USED INSTEAD
 * -------------------------
 * Membership in `PUBLIC_API_ERRORS`, a module-private `WeakSet` populated by
 * the `PublicApiError` constructor and by nothing else.
 *
 * A `WeakSet` is used rather than a symbol brand on the instance because a
 * symbol brand is *discoverable*: `Object.getOwnPropertySymbols(realInstance)`
 * hands the symbol to any code holding one genuine instance, which can then
 * `defineProperty` it onto a forgery. A `WeakSet` has no such surface — there
 * is no way to enumerate it, no way to reach it without a reference to this
 * module's binding, and no observable trace of membership on the object
 * itself. Consequently an error can only acquire this identity by actually
 * running the `PublicApiError` constructor.
 *
 * What this defeats, concretely:
 *   - assigning `name`                    → not consulted at all
 *   - matching `constructor.name`         → not consulted at all
 *   - carrying `code` / `status` / `message` (duck typing) → not consulted
 *   - a foreign subclass of `Error`       → never entered the constructor
 *   - `Object.setPrototypeOf(fake, PublicApiError.prototype)` → grafting a
 *     prototype does not add the object to the WeakSet
 *   - copying own properties off a real instance → membership is not a
 *     property, so there is nothing to copy
 *
 * THE TRUST BOUNDARY THIS DRAWS
 * -----------------------------
 * `PublicApiError` is exported, so any module in this repository can define a
 * new public error. That is deliberate and is exactly the boundary we want:
 * "authored in this repository" is the property we are asserting. Extending
 * this class is therefore a declaration that EVERY message the subclass can
 * carry is safe for the caller to read. Do not construct one with a message
 * built from an upstream error, a database error or any untrusted input.
 */

const PUBLIC_API_ERRORS = new WeakSet<object>()

/**
 * Base class for errors whose `code`, `message` and `status` are authored in
 * this repository and may be returned to the client verbatim.
 *
 * `abstract` on purpose: this class describes a contract, and every public
 * error should be a named type that says what went wrong.
 */
export abstract class PublicApiError extends Error {
  readonly code: string
  readonly status: number

  protected constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    PUBLIC_API_ERRORS.add(this)
  }
}

/**
 * The only trustworthy way to ask "is this one of our publishable errors?".
 *
 * Both conditions are required. The `WeakSet` check is the unforgeable one and
 * carries the security guarantee; `instanceof` adds prototype-chain sanity and
 * gives TypeScript the narrowing. Neither can be satisfied by an object that
 * did not run the constructor above.
 */
export function isPublicApiError(value: unknown): value is PublicApiError {
  if (typeof value !== "object" || value === null) return false
  return PUBLIC_API_ERRORS.has(value) && value instanceof PublicApiError
}

/** Inclusive bounds of a usable HTTP error status. */
export const MIN_PUBLIC_ERROR_STATUS = 400
export const MAX_PUBLIC_ERROR_STATUS = 599

/**
 * Whether a status is a real HTTP error code.
 *
 * A public error carrying anything else has a broken contract, and a broken
 * contract is not evidence that its message is safe to publish. Callers must
 * therefore treat a failing status as "unrecognised" and fall back to their
 * generic response — never invent a replacement status and publish the message
 * anyway, and never hand the raw value to `Response`/`NextResponse`, where an
 * out-of-range value throws a `RangeError` and turns a handled error into an
 * unhandled one.
 */
export function isValidPublicErrorStatus(status: unknown): status is number {
  return (
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= MIN_PUBLIC_ERROR_STATUS &&
    status <= MAX_PUBLIC_ERROR_STATUS
  )
}
