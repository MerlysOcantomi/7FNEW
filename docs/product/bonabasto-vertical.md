# Bonabasto — Food / Hospitality vertical experience

Status: **Approved foundation — implementation starts with BONA-00**

## Product identity

- **Commercial name:** Bonabasto
- **Brand line:** Bonabasto by sevenef
- **Technical vertical family:** `food-hospitality`
- **Initial experience key:** `bonabasto`
- **Canonical preview:** `https://preview-bonabasto.sevenef.com`
- **Canonical codebase:** `MerlysOcantomi/7FNEW`

Bonabasto is the first sevenef experience for the Food / Hospitality family. It is designed for food businesses that need to organise their daily operation, public presence and customer ordering from the same workspace.

The initial product is especially suitable for takeaway and small food businesses, while the Food / Hospitality family must remain capable of supporting restaurants, cafés, bars and future hospitality experiences without forking sevenef Core.

Bonabasto is **not** an independent technical platform. It is a vertical experience over the shared sevenef platform.

## Architecture rule

```text
sevenef Core
    +
shared products / modules / capabilities
    +
Food / Hospitality vertical defaults
    +
Bonabasto experience and vocabulary
    +
workspace-specific entitlements and configuration
```

The vertical shapes the experience. It does not own or duplicate shared platform capabilities.

Examples:

- Smart Inbox remains the shared Smart Inbox.
- Presence remains the shared Presence engine.
- People / Clients remain shared workspace identities.
- Commerce can be activated by Bonabasto, Finesse, Oloju or another future experience.
- Ticketing, Virtual Classroom or other modules are reusable capabilities and must not be implemented as Bonabasto-only systems.

## Business Profile and Carta

Bonabasto follows the same source-of-truth principle already used by sevenef Business Profile and Presence.

The business identity lives once in the shared Business Profile.

The food and drinks offer is presented in Bonabasto as **Carta**. The Carta must become an operational catalog rather than duplicated public-page content. Presence, QR experiences, ordering surfaces and future device surfaces project from that shared source.

```text
Business Profile
    -> Presence
    -> connected public profiles/channels when supported

Catalog / Carta
    -> Presence Carta
    -> QR
    -> Ordering
    -> Table Display
    -> other supported projections
```

A business edits an item once. Connected surfaces must consume the same canonical data instead of maintaining independent copies.

## Initial reusable domains

The first implementation sequence should prove these reusable domains with real persistence and workspace scoping:

1. **Catalog / Commerce** — categories, products, prices, availability, media and simple options.
2. **Orders** — canonical order, order lines, source, fulfilment, payment state and status history.
3. **Inventory** — stock items and immutable movement history.
4. **Purchasing** — suppliers, purchases and receiving into inventory.
5. **Kitchen** — operational preparation views over canonical Orders, never a duplicate order store.
6. **Presence Food experience** — public business information, Carta and ordering based on shared sources.

Capabilities are added to the canonical platform catalog only when backed by real implementation. Do not create speculative capability keys.

## Daily operating model

Bonabasto is expected to use an **order-first** Today experience once the Orders backend is real.

Until then, the product must follow the sevenef no-fake-product rule: no real workspace should auto-activate a Today mode that depends on mock orders.

Today answers: **what needs attention now?**

Business health, trends and performance belong to the vertical Overview rather than being duplicated into Today.

## Food / Hospitality family

Bonabasto is the first commercial experience in this family, not the definition of the entire family.

Future experiences may combine the same shared modules differently:

```text
food-hospitality
├── bonabasto
├── bar          (future)
├── club         (future)
└── discoteca    (future)
```

A future Club or Discoteca experience may add capabilities such as Ticketing, Guest List, VIP Tables or Access while continuing to reuse shared Orders, Payments, Reservations, Growth, Presence and other platform modules where appropriate.

Do not build those future experiences as part of the initial Bonabasto implementation.

## Prototype repository

The separate `MerlysOcantomi/bonabasto` repository is a **product/UX prototype created with v0**.

It is not the canonical Bonabasto application and must not become a parallel backend.

For every prototype idea, decide explicitly:

- **KEEP** — preserve the product interaction.
- **ADAPT** — keep the idea but fit it to sevenef architecture.
- **REDESIGN** — solve the same user need better.
- **DROP** — do not carry the idea into the product.

Implementation belongs in `7FNEW` and should use sevenef Core, design primitives, permissions, entitlements and shared modules.

## Canonical preview contract

Owner-facing Bonabasto review uses only:

```text
https://preview-bonabasto.sevenef.com
```

The host must point to the Bonabasto implementation inside the sevenef Vercel project / codebase, **not** to the standalone v0 prototype project.

Autogenerated `*.vercel.app` URLs are diagnostic deployment URLs only. They are not the canonical review URL.

The preview hostname is reserved now. DNS/Vercel binding, Preview environment configuration and Google OAuth callback are activated when the Bonabasto implementation branch requires them.

If Google OAuth is enabled for Bonabasto preview, the callback is:

```text
https://preview-bonabasto.sevenef.com/api/auth/callback/google
```

## BONA-00 — first implementation mission

The first code mission should establish the product contract before adding restaurant data models:

1. register the Food / Hospitality vertical family;
2. register the Bonabasto experience without changing Finesse behaviour;
3. register Bonabasto as an entry product;
4. add its vertical/experience resolution and navigation contract;
5. reserve the future order-first Today mode without activating fake data;
6. add tests proving fallback and Finesse compatibility;
7. bind the canonical preview to the Bonabasto preview implementation when the reviewable surface exists.

No Orders, Catalog, Inventory or Kitchen persistence should be invented inside BONA-00. Those land in the following implementation missions with their real capability evidence.
