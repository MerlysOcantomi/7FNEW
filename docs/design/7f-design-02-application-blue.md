# SESSION 7F-DESIGN-02 - Premium blue application bridge

## Scope and approval

The owner requested applying the premium visual language to the actual sevenef application and Finesse, not another isolated mockup. Continue the existing Design Lab branch and draft PR #37. Production stays unchanged until owner visual approval.

- sevenef: `sevenef-blue-premium`, blue-first petrol, canvas `#071C2C`.
- Finesse: `finesse-petrol-blue`, slightly brighter, canvas `#082433`.
- Existing palettes and explicit browser preferences remain valid.
- No DB migration, auth bypass, new product route, generated metrics, DNS, OAuth, billing or production deployment setting changes.

## Implementation

`core/design/blue-palettes.ts` is the shared color source for the Lab and application. `core/design/app-blue.ts` consumes the existing validated Foundation token compiler and maps its output into the existing app, sidebar, shared component and Inbox vocabulary. It is a consumer adapter, not a new design engine.

`core/theme-registry.ts` centralizes the application allow-list and bootstrap. Application defaults adopt the two approved directions; the existing vertical pack and Presence template/publisher declarations stay unchanged. Query > explicit browser selection > resolved app default. Missing workspace or resolution failure keeps the established Midnight fallback. Public `/sites`, `/widget`, `/cliente` and `/finesse` surfaces are not automatically enrolled in the two app skins. No arbitrary CSS or user data is inserted in the style block.

`app/premium-ui.css` is opt-in to the two new theme keys. It covers AppShell and the Core dashboard's existing h-dvh/direct-main shell. Shared cards, bordered token-backed panels, primary/secondary buttons, inputs, select triggers and active tabs receive material depth. Glass is selective and has an opaque fallback. Hover does not change geometry; content arrival is a finite opacity transition. Reduced motion and forced-colors fallbacks are included. AppShell changes are three data attributes only; its auth, provider ordering and viewport/scroll geometry are unchanged.

The existing appearance selector exposes the complete blue recommendations plus all old choices. It reads the effective theme rather than incorrectly assuming Midnight when no stored choice exists. A manual choice clears the preview theme query so reload does not undo the choice.

## Contrast refinements

Approved CTA fills are retained: sevenef `#1F7AA8`, Finesse `#267EA6`. Hover fills are darkened within the same hue so white labels remain readable. Finesse secondary text is slightly lifted to `#C0D1D9` for its brightest panel. Solid-color checks are not a claim of whole-page accessibility, particularly over images/transparency or legacy status colors.

## Validation performed before publication

- Strict TypeScript compilation of the pure adapter, theme registry and their dependency/test set.
- 26 passing Node tests: 16 existing Foundation tests (palette count updated to ten) and 10 application bridge tests.
- Covers old IDs, contract round-trip, query/storage precedence, blocked storage, public-site isolation, alias cycles/missing references, blue-first palette guard, CTA/hover/text/focus contrast.
- TSX syntax/transpilation of RootLayout, AppShell, Button and ThemeModeToggle.
- PostCSS parsing of the material stylesheet and generated palette stylesheet.
- Unchanged local dependency snapshots were checked against their Git blob SHAs.

Full repository lint/typecheck and browser UI verification are not claimed here. The local environment cannot clone/install the full application; its Playwright Chromium binary is absent. Vercel build and deployment results must be reported from the actual new commit, not a previous READY deployment.

## Owner preview review before merge

Open the authenticated application with `?theme=sevenef-blue-premium`; use `?vertical=beauty&theme=finesse-petrol-blue` to review the Beauty presentation without changing workspace identity. Normal account/session checks still apply. Deployment sharing does not bypass application authentication.

Review Core Overview, Beauty Overview/Today, Inbox, Calendar and Clients; check normal, selected, hover, keyboard focus, invalid, disabled and modal states. Compare desktop and mobile, including bottom navigation clearance and Inbox nested scroll. Verify a previously saved legacy theme still wins and switching back restores its material. No screenshot fixture should be presented as a live production page.

This is the shared visual foundation applied to existing screens. Hardcoded/legacy component exceptions still require visual review; it is not a claim that every historical screen was redesigned. Foundation extraction, logo animation, generated palettes and Presence editing remain separate work.
