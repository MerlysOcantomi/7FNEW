# Design System -> Forte Foundation promotion contract

Status: **product-first candidate**
Origin product: **sevenef / 7FNEW**
Working branch: `codex/sevenef-premium-design-system`
Preview host: `preview-designsystem.sevenef.com`

## Intent

The SevenEF Premium Surface + Motion System is being built and validated first inside the real SevenEF product. It is intentionally designed with a reusable boundary so the stable, product-agnostic portion can later be extracted into **Forte Foundation**.

This document does **not** declare the Foundation block stable today. Foundation's admission rule remains product-first: build in the product, validate in real context, evaluate generalization, then extract.

## Candidate block boundary

Provisional Foundation id: `premium-design-system`

The reusable block is expected to contain:
- semantic design tokens rather than SevenEF-specific raw colors;
- surface contracts: quiet, glass, glass-strong, tinted, elevated, luminous;
- motion contracts: reveal, line reveal, panel open, hover lift, selected state, AI working state, success settle;
- reduced-motion and accessibility rules;
- theme/palette adapter contract;
- brand-layer adapter contract;
- reusable implementation primitives and independent tests;
- integration guidance for Next.js/Tailwind products.

The Foundation block must **not** contain:
- the SevenEF wordmark, favicon artwork or product copy;
- Mr. Forte character assets or SevenEF onboarding narrative;
- Finesse/Oloju-specific branding;
- a customer's logo or extracted palette;
- SevenEF route names, workspace data or product navigation;
- a fixed palette that prevents downstream customization.

Those stay as product adapters/presets layered over the reusable block.

## Layering contract

```text
Foundation premium-design-system
  -> semantic surfaces + motion + adapters
       -> SevenEF theme family
            -> SevenEF / Finesse / Oloju experience
                 -> optional business brand layer for public Presence
```

A copied Foundation block must remain customizable in the receiving product. Foundation is not a central runtime dependency.

## Preview as validation evidence

`https://preview-designsystem.sevenef.com` is the canonical visual validation surface for the SevenEF implementation.

The lab should demonstrate:
1. multiple palette families over the same semantic surfaces;
2. dark and light behavior without paper-white card walls;
3. motion and `prefers-reduced-motion`;
4. responsive behavior;
5. focus/hover/selected/AI-working states;
6. an operational overview composed from the primitives;
7. clear separation between reusable primitives and SevenEF-specific branding.

Approval in the preview is evidence for extraction, not automatic admission to Foundation.

## Promotion path

```text
SevenEF implementation
  -> preview validation
  -> stabilize contracts
  -> evaluate Foundation seven admission criteria
  -> add/update Foundation registry candidate
  -> extract product-agnostic implementation
  -> independent tests + integration guide
  -> Foundation draft 0.x
  -> consume by copy + provenance manifest
  -> stable 1.x after proven reuse
```

When promoted, the Foundation block must follow the existing `blocks/_template`, semver, catalog, tests, integration guide, CHANGELOG and provenance rules.

## Design rule while building in SevenEF

Every new Design System primitive should answer two questions:

1. Is this a **general visual capability** that another product could reuse?
2. Is this **SevenEF identity/presentation** layered on top of that capability?

If the first, keep its API semantic and extractable. If the second, keep it in the SevenEF adapter/preset layer.

This prevents the current work from becoming a one-off redesign while also avoiding premature abstraction in Foundation.
