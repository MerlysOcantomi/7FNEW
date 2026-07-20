# Sevenef Presence — engine (FOUNDATION)

Shared engine to **build and publish business websites**. Presence is not a
Finesse feature: it ships inside 7F SaaS plans and verticals, is sold standalone
to businesses that don't use 7F SaaS, and is produced from Mr Forte Lab.

> **Status: foundation.** This directory is a **contract + registry + pure
> logic** layer only. There is **no** Prisma model, route, UI, or AI call wired
> yet — see `docs/presence-architecture.md` for the full architecture, data-flow
> diagram, risks and the intended persistence mapping.

## What lives here

| File | Responsibility |
|---|---|
| `types.ts` | Core contracts: `PresenceSite`, `PresencePublication`, `PresenceDomain`, `PresenceMedia`, resolution result, lifecycle/ownership unions. |
| `sections.ts` | Extensible **section registry** (hero, services, gallery, reviews, team, booking, whatsapp, location, faq, promotions). Each section declares which Business Profile fields it reads. |
| `templates.ts` | Versioned **template registry** + the four initial families (`sevenef-platform-landing`, `finesse-vertical-landing`, `smart-inbox-product-landing`, `business-site`). |
| `themes.ts` | Bridge over the existing 7F theme tokens (`core/theme.ts` / `app/globals.css`). No colors declared here. |
| `content-source.ts` | **Read-only** projection of the Business Profile → renderable content. Enforces "do not duplicate public data". |
| `resolve.ts` | Pure slug/hostname resolution + entitlement gating (plan-included **or** standalone subscription). |
| `freya.ts` | Freya provider **interfaces** + a default **deterministic (no-AI)** style/media provider. |
| `manifest.ts` | `EngineManifest` registered in `core/registry`. |

## Principles

- **Multi-tenant.** Everything is keyed by `workspaceId`; one shared engine, no
  repo/Vercel-project per client.
- **No data duplication.** The Business Profile
  (`Workspace.config.businessProfile` + `serviceCatalog` + `ChannelConnection`)
  stays the single source of truth. Later edits happen there, not on the site.
- **Photos never in git.** `PresenceMedia` only references an external
  `storageKey`/`url` (Vercel Blob today).
- **No mandatory AI vendor.** Freya capabilities sit behind interchangeable
  providers; the default is a real deterministic engine (`generatedBy:
  "heuristic"`), not a fake demo.
- **Real work photos keep their integrity.** Variants are crop/resize/format
  only (`FreyaMediaAssessment.preserveIntegrity`).

## Tests

```bash
npx tsx --test engines/presence/*.test.ts
```
