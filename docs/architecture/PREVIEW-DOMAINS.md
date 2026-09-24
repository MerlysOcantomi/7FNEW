# Canonical preview domains

This file is the naming and publication source of truth for stable product preview hosts in the **sevenef** ecosystem.

A canonical preview host is bound to one permanent Git branch in the Vercel project `7-fnew`. Feature/session branches may be used for implementation, but owner-facing review is promoted to the canonical preview branch before review.

## Canonical preview hosts and branches

| Product / experience | Canonical preview host | Canonical Git branch | Status | Notes |
|---|---|---|---|---|
| sevenef platform / core | `preview.sevenef.com` | `preview-sevenef` | active target | General platform/core preview. |
| SevenEF Design System Lab | `preview-designsystem.sevenef.com` | `preview-designsystem` | reserved | Stable design-system review surface; not a separate product. |
| Finesse Beauty | `preview.getfinesse.app` | `preview-finesse` | active target | Finesse Beauty preview on its managed product domain. |
| Finesse Ink | `preview-ink.sevenef.com` | `preview-ink` | reserved | Tattoo vertical / Finesse Ink experience. |
| Bonabasto (Food / Hospitality) | `preview-bonabasto.sevenef.com` | `preview-bonabasto` | active target | Canonical Bonabasto preview. The technical vertical family remains Food / Hospitality. |
| Olojú | `preview-oloju.sevenef.com` | `preview-oloju` | reserved | Domain omits the accent by design. |
| Scholara | `preview-scholara.sevenef.com` | `preview-scholara` | reserved | Scholara can run inside Olojú and also be sold standalone. |
| Smart Inbox standalone | `preview-inbox.sevenef.com` | `preview-inbox` | active target | Standalone packaging of the shared Smart Inbox Core; not a separate technical Inbox implementation. |

## Permanent publication rule

1. Do not bind a canonical preview domain directly to a temporary implementation branch such as `codex/*`, `claude/*`, `work/*`, or `feat/*`.
2. Implementation may happen on temporary branches, but the reviewable state is promoted/merged to the canonical `preview-*` branch.
3. Vercel must map each canonical preview domain to the corresponding canonical Git branch in the table above.
4. A new commit on a canonical preview branch must update the same fixed preview URL automatically through Vercel Git integration.
5. Preview domains do not create technical forks. Products remain experiences/packages over the shared **sevenef Core**.
6. Production domains are a separate decision and must not be inferred from preview names.
7. Bonabasto uses `preview-bonabasto.sevenef.com`; do not use the former provisional `preview-food.sevenef.com`.
8. The old shared `preview` branch may remain temporarily for migration, but canonical product domains should not share it once their dedicated `preview-*` branch is active.

## Publication flow

```text
implementation branch
        |
        v
validate
        |
        v
canonical preview-* branch
        |
        v
fixed preview domain
        |
        v
owner review
        |
        v
master when approved and safe
```

## Google OAuth

For preview hosts that use the current Google OAuth flow, the redirect URI follows:

```text
https://<preview-host>/api/auth/callback/google
```

The first preview callbacks selected for activation are:

```text
https://preview.sevenef.com/api/auth/callback/google
https://preview.getfinesse.app/api/auth/callback/google
```

Add additional callbacks only when that preview is actually activated and requires Google login.

## Architecture reminder

The preview hostname selects a product experience. It does **not** mean the product has a separate copy of shared modules.

Examples:

- Finesse uses the shared Smart Inbox Core with Finesse-specific capabilities/presentation.
- Smart Inbox standalone is product packaging over that same shared Inbox Core.
- Scholara may be enabled inside Olojú while also having its own standalone preview/product experience.
- The SevenEF Design System Lab is an isolated visual validation surface over the same sevenef codebase, not a separate product.
