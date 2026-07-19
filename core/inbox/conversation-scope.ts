/**
 * ConversationScope — conceptual contract ONLY in this phase. No Prisma field,
 * no classification logic, no consumer reads it yet.
 *
 * Why it exists now: channels like WhatsApp mix BUSINESS conversations with
 * PERSONAL ones when an operator connects a number that is not exclusive to
 * the business. The product policy (decided ahead of any WhatsApp
 * integration) is:
 *
 *   - Recommend a business-exclusive number during channel connection.
 *   - Allow a controlled transition when the platform modality permits it.
 *   - NEVER run automations (Fanny drafts, auto-tasks, follow-ups, bulk
 *     actions) over conversations scoped `personal` or `unclassified`.
 *   - Never rely on AI alone to decide a conversation is private — operator
 *     confirmation is required to mark `personal`, and `unclassified` must be
 *     treated as potentially personal (automation-off) until resolved.
 *
 * Where it lands later (planned, deliberately NOT implemented here):
 *   - Persistence: a `scope String @default("business")` column on
 *     `Conversation` (additive migration), defaulted per channel — channels
 *     without a personal dimension (email business inbox, web_chat, portal,
 *     manual) backfill as `business`; personal-capable connections default
 *     new conversations to `unclassified`.
 *   - Connection level: `ChannelConnection.config` gains a declared
 *     `numberUsage: "business_only" | "mixed"` hint set during onboarding.
 *   - Enforcement: the automation gates (`modules/inbox/auto-task-policy.ts`
 *     and the intelligence pipeline entry in `modules/inbox/intelligence.ts`)
 *     check the scope BEFORE processing — a policy-layer guard, not a prompt
 *     instruction.
 *   - UI: a scope chip + operator toggle in the conversation header /
 *     context panel; bulk review surface for `unclassified`.
 */
export type ConversationScope = "business" | "personal" | "unclassified"

/**
 * Scopes over which ANY automation (AI triage side-effects, drafts,
 * auto-created tasks, scheduled follow-ups) is allowed to run. Exported so
 * the future enforcement point has a single, testable source of truth.
 */
export const AUTOMATION_ALLOWED_SCOPES: readonly ConversationScope[] = ["business"]
