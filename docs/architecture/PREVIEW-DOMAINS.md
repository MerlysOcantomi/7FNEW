# Canonical preview domains

This file is the naming source of truth for stable product preview hosts in the **sevenef** ecosystem.

These names are **reserved conventions**. A row marked `reserved` does not imply that DNS, Vercel domain assignment, routing, OAuth, or the product itself is already live.

## Reserved preview hosts

| Product / experience | Canonical preview host | Status | Notes |
|---|---|---|---|
| sevenef platform / core | `preview.sevenef.com` | reserved | General platform preview. |
| Finesse Beauty | `preview.getfinesse.app` | reserved | Finesse Beauty preview on its managed product domain. |
| Finesse Ink | `preview-ink.sevenef.com` | reserved | Tattoo vertical / Finesse Ink experience. |
| Food vertical | `preview-food.sevenef.com` | reserved-temporary | Temporary preview name until the food product receives its final commercial name. |
| Olojú | `preview-oloju.sevenef.com` | reserved | Domain omits the accent by design. |
| Scholara | `preview-scholara.sevenef.com` | reserved | Scholara can run inside Olojú and also be sold standalone. |
| Smart Inbox standalone | `preview-inbox.sevenef.com` | reserved | Standalone packaging of the shared Smart Inbox Core; not a separate technical Inbox implementation. |

## Rules

1. Do not invent alternate preview hostnames for the products above without updating this file first.
2. Preview domains do not create technical forks. Products remain experiences/packages over the shared **sevenef Core**.
3. A preview hostname should normally point to the stable `preview` Git branch when that product is activated for preview.
4. Production domains are a separate decision and must not be inferred from these preview names.
5. The Food preview name is intentionally provisional. Replace it here when the final product name is chosen.

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

Do not add every reserved preview host to Google OAuth pre-emptively. Add a callback when that preview is actually activated and requires Google login.

## Architecture reminder

The preview hostname selects a product experience. It does **not** mean the product has a separate copy of shared modules.

Examples:

- Finesse uses the shared Smart Inbox Core with Finesse-specific capabilities/presentation.
- Smart Inbox standalone is product packaging over that same shared Inbox Core.
- Scholara may be enabled inside Olojú while also having its own standalone preview/product experience.
