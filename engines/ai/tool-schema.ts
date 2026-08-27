/**
 * AI-06 — Canonical zod input schema → provider-neutral JSON Schema.
 *
 * Provider tool definitions are DERIVED from the canonical
 * `PlatformToolDefinition.inputSchema`; there is deliberately no second
 * hand-maintained parameters document that could drift from the schema that
 * actually validates execution input. The converter covers exactly the
 * constructs the canonical catalog uses (objects of scalars, enums, arrays,
 * optional/nullable/default wrappers, string/number bounds) and FAILS CLOSED
 * on anything it cannot represent: a tool whose schema cannot be converted
 * is never offered to the provider (see `buildProviderToolsForContext`).
 */

import { z } from "zod"

export class ToolSchemaConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ToolSchemaConversionError"
  }
}

type JsonSchema = Record<string, unknown>

interface UnwrappedSchema {
  schema: z.ZodTypeAny
  optional: boolean
}

function unwrap(schema: z.ZodTypeAny): UnwrappedSchema {
  let current = schema
  let optional = false
  // Unwrap optional/nullable/default wrappers in any order.
  for (;;) {
    if (current instanceof z.ZodOptional) {
      optional = true
      current = current.unwrap()
      continue
    }
    if (current instanceof z.ZodDefault) {
      optional = true
      current = current._def.innerType as z.ZodTypeAny
      continue
    }
    if (current instanceof z.ZodNullable) {
      current = current.unwrap()
      continue
    }
    return { schema: current, optional }
  }
}

function stringChecks(schema: z.ZodString): JsonSchema {
  const out: JsonSchema = { type: "string" }
  for (const check of schema._def.checks) {
    if (check.kind === "min") out.minLength = check.value
    if (check.kind === "max") out.maxLength = check.value
  }
  return out
}

function numberChecks(schema: z.ZodNumber): JsonSchema {
  const out: JsonSchema = { type: "number" }
  for (const check of schema._def.checks) {
    if (check.kind === "int") out.type = "integer"
    if (check.kind === "min") out.minimum = check.value
    if (check.kind === "max") out.maximum = check.value
  }
  return out
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  const description =
    typeof schema.description === "string" && schema.description
      ? { description: schema.description }
      : {}
  const inner = unwrap(schema).schema

  if (inner instanceof z.ZodString) return { ...stringChecks(inner), ...description }
  if (inner instanceof z.ZodNumber) return { ...numberChecks(inner), ...description }
  if (inner instanceof z.ZodBoolean) return { type: "boolean", ...description }
  if (inner instanceof z.ZodEnum) {
    return { type: "string", enum: [...inner._def.values], ...description }
  }
  if (inner instanceof z.ZodArray) {
    return { type: "array", items: convert(inner.element as z.ZodTypeAny), ...description }
  }
  if (inner instanceof z.ZodObject) return { ...convertObject(inner), ...description }

  throw new ToolSchemaConversionError(
    `Unsupported zod construct for provider tool parameters: ${inner._def?.typeName ?? "unknown"}`,
  )
}

function convertObject(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const [key, value] of Object.entries(schema.shape)) {
    const field = value as z.ZodTypeAny
    properties[key] = convert(field)
    if (!unwrap(field).optional) required.push(key)
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  }
}

/**
 * Convert a canonical tool input schema to JSON Schema parameters. Throws
 * `ToolSchemaConversionError` on unsupported constructs — callers must treat
 * that as "do not expose this tool", never as "expose without a schema".
 */
export function toolInputJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const inner = unwrap(schema).schema
  if (!(inner instanceof z.ZodObject)) {
    throw new ToolSchemaConversionError("Tool input schemas must be zod objects")
  }
  return convertObject(inner)
}
