# SESSION 7F-DESIGN-02.1 - Deliver the application skins on canonical previews

## Owner direction

Use the existing sevenef and Finesse preview domains, not temporary deployment-share URLs, for product review:

- https://preview.sevenef.com
- https://preview.getfinesse.app

At inspection both hosts were aliases of the 7-fnew Vercel Preview deployment for branch `preview`, commit `cfc3777d89765697600efdf45cc632c7a778d2ae`.

## Integration

Port the reviewed application theme bridge from `57768e65e987289506912353c2ec8f3c3c81c313` to the existing `preview` branch. Reuse exact Git blobs for the application layout, premium stylesheet, three component files, theme registry/resolver and the complete pure `core/design` dependency tree. This is one implementation, not an independently rewritten skin.

The design source and preview branch diverged. Do not replace the preview ref with the design ref: that would discard 44 commits, including the current Inbox work. The new commit has the existing preview HEAD as its parent. Keep all files outside the explicit port unchanged.

No changes to middleware, authentication, Google OAuth, domain/DNS assignment, environment variables, database, API/business logic, public Presence pages, production settings or `master`. In particular the preview's Inbox files, locale catalogs and vertical configuration stay intact. Do not expose the local Design Lab as a new public route through this port.

## Review

- sevenef application: `/?theme=sevenef-blue-premium`
- Finesse application: `/today?theme=finesse-petrol-blue`

Use each path on its corresponding canonical host. App login is still required. An existing saved appearance remains respected unless an explicit theme is selected. The theme query is an appearance preference only; it neither creates a workspace nor changes its vertical or permissions.

## Validation scope

Source content and dependency boundaries were reviewed. The port uses the exact already-built source blobs rather than regenerating their code. Verify the resulting file diff preserves preview-only work before updating the branch ref, then verify the new Vercel build and the deployment returned for each canonical hostname.

The execution container cannot resolve github.com, so full local dependency installation and full local repository tests cannot be run in this session. Do not claim authenticated end-to-end or visual acceptance merely because the deployment is READY. Production rollout and owner visual acceptance remain separate decisions.
