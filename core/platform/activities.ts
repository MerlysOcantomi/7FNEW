/**
 * FOUND-01 — Canonical activity keys.
 *
 * An ACTIVITY names a meterable unit of consumption for future usage
 * attribution (ARCH-03 §9/§14): `{workspace, product, capability, tool,
 * activity, experience, provider, model}`. FOUND-01 types only this
 * dimension's keys — no telemetry events, no usage records, no pricing, no
 * persistence, no sinks (those are the Usage Meter / telemetry missions).
 *
 * Keys name the platform activity, never a provider or AI model. Every key
 * below is backed by an AI execution path that exists in the repo today
 * (ARCH-03 §2 inventory). Append with evidence only.
 */

export const ACTIVITY_KEYS = [
  "ai.reply_draft", //             Fanny reply drafts (modules/inbox/intelligence.ts)
  "ai.conversation_summary", //    Fanny conversation summaries
  "ai.message_classification", //  Fanny classification + message short-intent
  "ai.composer_assist", //         inbox composer assist route
  "ai.document_scan", //           tools/scan.ts document extraction
  "ai.image_generation", //        tools/image-generator.ts (DALL·E path)
  "ai.voice_session", //           Finesse voice realtime sessions
] as const

export type ActivityKey = (typeof ACTIVITY_KEYS)[number]
