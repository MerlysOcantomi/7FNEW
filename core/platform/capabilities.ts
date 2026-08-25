/**
 * FOUND-01 — Canonical capability keys.
 *
 * A CAPABILITY names one business functionality the platform can grant to a
 * workspace (ARCH-02 §1). Keys are `<domain>.<action>` where the domain is a
 * BUSINESS NOUN — never a product name, an AI model, an API route, a UI
 * component, a persona, or a storage model. In particular there is exactly
 * one `person.*` domain: today's `Contact` / `Cliente` / `ClientAuth` split
 * (ARCH-01 §17 follow-up) stays invisible behind it, so the future person
 * convergence changes zero keys (ARCH-02 §5.2, ARCH-03 §10).
 *
 * Concept boundaries (ARCH-02 §1):
 *   product     bundles capabilities         (`smart_inbox`)
 *   capability  what the WORKSPACE can do    (`conversation.reply`)
 *   permission  what THIS USER may exercise  (role → permission set; no
 *               separate permission catalog exists yet — see tool-definition)
 *   tool        one executable operation     (`draft_reply`)
 *   activity    usage-attribution key        (`ai.reply_draft`)
 *
 * DELIBERATELY PARTIAL: every key below is backed by a feature that exists in
 * the repo today (evidence in comments). Do not add speculative keys; extend
 * with evidence, appending only.
 */

export const CAPABILITY_KEYS = [
  // core — shared infrastructure, granted to every valid workspace (ARCH-02 §3)
  "workspace.read", //      workspace resolution + settings surfaces
  "workspace.settings", //  /administracion, workspace config routes
  "member.read", //         modules/usuarios
  "person.read", //         modules/clientes + inbox contacts
  "person.write", //        client create/update, inbox contact promotion
  "task.read", //           WorkspaceTask surfaces (Today, tasks)
  "task.write", //          WorkspaceTask write layer (incl. Fanny auto-task)
  "profile.read", //        Business Profile (app/api/workspace/business-profile)
  "profile.write", //       Business Profile editing
  "audit.read", //          core/activity history surfaces

  // smart_inbox
  "conversation.read", //    modules/inbox conversations
  "conversation.reply", //   composer + outbound-service
  "conversation.convert", // conversation → CRM conversion
  "channel.connect", //      ChannelConnection setup
  "channel.manage", //       channel administration
  "ai.classify", //          Fanny pipeline classification (modules/inbox/intelligence.ts)
  "ai.summarize", //         Fanny conversation summaries
  "ai.draft", //             Fanny reply drafts
  "ai.assist", //            composer assist (proofread/rewrite/translate)

  // growth
  "campaign.read", //   modules/campanas (Campaign)
  "campaign.create", // modules/campanas
  "content.create", //  modules/contenido (ContentPiece / ContentIdea)
  "site.publish", //    engines/presence publication flow
  "site.manage", //     engines/presence site management

  // finance
  "invoice.read", //     modules/facturacion (Factura)
  "invoice.create", //   modules/facturacion
  "transaction.read", // modules/finanzas (Transaccion)

  // granted via add-on/offering — not mapped to a product here (see catalog.ts)
  "voice.session", // Finesse voice sessions (resolveFinesseVoiceEntitlement)
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]
