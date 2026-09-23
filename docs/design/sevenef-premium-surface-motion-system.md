# SevenEF Premium Surface + Motion System

Status: foundation contract for implementation
Branch: `codex/sevenef-premium-design-system`

## 1. Goal

SevenEF must feel like the same premium digital universe as SKINA and MrForteLab after sign-in, not like a generic SaaS dashboard. The system must remain operational, low-fatigue and accessible while adding controlled depth, glass, light and motion.

This is a shared system, not a one-off Finesse redesign.

## 2. Architecture

The visual stack is layered:

1. **SevenEF Premium System** — shared surfaces, typography, motion, elevation, glow rules.
2. **Theme family** — Midnight, blue/navy family, Petrol, Rose, Sage, Noir/Gold, light families.
3. **Product/vertical default** — SevenEF Core, Finesse, Oloju, future verticals.
4. **Business brand layer** — logo/palette adaptation for Presence and customer-facing surfaces.

Product components consume semantic tokens. They must not hardcode palette colors.

## 3. Palette policy

The active product system is intentionally small:

- `midnight` — **Midnight Blue**, the true blue-black dark theme. No violet or purple cast.
- `sevenef-pearl-blue` — sevenef light / pearl companion.
- `petrol-pearl` — Finesse default: polished white/pearl surfaces with petrol reserved for interaction.
- `finesse-rose-cream-gold` — Finesse warm alternative: cream, champagne and restrained antique rose.

Product defaults:
- sevenef Core → `midnight`.
- Finesse → `petrol-pearl`.
- Finesse dark → shared `midnight`, not a separate petrol-dark skin.
- Solid / Glass remains a material choice orthogonal to palette.

Compatibility keys such as `sevenef-blue-premium`, `finesse-petrol-blue`, `lavender-mist` and `rose-nude` remain readable during migration but are not active selector choices. Persisted legacy choices normalize onto the approved directions rather than keeping purple or petrol-dark experiences alive.

Theme color does not define component behavior. The same quiet/glass/elevated/luminous surface roles work across active families.

### Finesse onboarding reference

The deployed Finesse onboarding at `https://finesse-onboarding-experience.vercel.app` is a canonical visual reference for the Finesse product layer, not a separate design system.

Preserve these material cues when Finesse application surfaces are migrated:
- warm pearl / ivory canvas around `#F7F5F0`
- polished white operational surfaces
- deep blue-petrol interaction color around `#073B45`, never green-led
- restrained champagne material accent around `#CBA77B`
- bright inset highlights and soft long shadows instead of gray card walls
- 22–30px radius language for expressive/onboarding surfaces; operational controls remain denser
- Geist/product sans for working UI; editorial serif is reserved for selective brand moments, not dense operational data

The onboarding's old green-leaning petrol dark token is not adopted. Finesse dark uses the shared Midnight Blue material so the operational product stays coherent and blue-led.

## 4. Surface vocabulary

Additive semantic surfaces:
- `surface.quiet` — content-first, nearly transparent
- `surface.glass` — subtle translucent panel
- `surface.glassStrong` — focused glass with stronger separation
- `surface.tinted` — low-intensity brand tint
- `surface.elevated` — raised operational panel
- `surface.luminous` — selected / AI / important state, controlled glow

Rules:
- no default paper-white card field
- no gray-card wall
- glass is not used everywhere
- glow is stateful, not decorative noise
- content can live directly on the canvas when a card adds no meaning

## 5. Motion vocabulary

Motion is guidance:
- `reveal` — fade + slight directional emergence
- `lineReveal` — SevenEF signature line grows from center/outward
- `panelOpen` — subtle opacity/depth transition
- `hoverLift` — minimal elevation, no playful bounce
- `selectedGlow` — one controlled light pass, then stable
- `aiThinking` — slow moving light / pulse with reduced-motion fallback
- `successSettle` — motion resolves and calms

All motion must respect `prefers-reduced-motion`.

## 6. SevenEF logo + favicon

Brand direction:
- wordmark: `SEVENEF`
- horizontal signature line crosses/reveals the wordmark
- favicon/app icon derives from the same line language, not a separate 7F mark
- static and animated logo are one system

Primary reveal:
1. near-black / deepest petrol canvas
2. faint central favicon/line appears from darkness
3. line grows
4. letters reveal from the center outward
5. glow settles

## 7. Onboarding with Mr. Forte

Narrative:
1. screen is almost off — black / deepest petrol
2. only the favicon/signature is visible on the back of an office chair
3. the chair moves toward the user from the darkness
4. environmental light slowly shifts into the SevenEF petrol/navy atmosphere
5. chair turns
6. Mr. Forte faces the user in a presentation/welcome posture
7. he introduces himself
8. questions appear below the desk line
9. he takes notes on the tablet while the user answers
10. configuration remains editable
11. once understood, he presents the tablet toward the user
12. tablet content is live UI, not baked into video
13. plan cards and explanations adapt to the confirmed configuration

The user loop is:
`understand -> propose -> correct -> recalculate -> confirm -> recommend plan`.

## 8. Overview direction

The product overview should be a premium operational command center, not a promotional movie.

Use:
- one strong focus/Today block
- Attention
- Smart Inbox
- Agenda
- clients / work
- one contextual AI insight / next step
- calm atmospheric depth
- limited cards
- transparent/tinted surfaces
- agent presence only where useful

Cinematic silhouettes/agent scenes belong mainly in landing, onboarding, transitions and selected empty states — not as permanent dashboard decoration.

## 9. Business brand adaptation

For public Presence/customer-facing pages:
- if logo exists: extract brand colors, normalize them and derive accessible semantic tokens
- if no logo: propose curated palettes from business type + desired style
- never copy raw logo colors blindly
- allow: use logo colors / be inspired by logo / choose another palette

For internal SaaS:
- product identity remains dominant
- business logo/accent can appear subtly
- do not recolor the whole operational UI from arbitrary customer colors

## 10. Implementation order

1. Build an isolated Premium UI Lab/preview route using existing data/theme infrastructure.
2. Add semantic premium-surface + motion tokens additively.
3. Formalize the blue/navy theme family (`north-sea` audit).
4. Implement logo/favicon static system.
5. Implement motion primitives.
6. Prototype SevenEF overview in the Lab.
7. Prototype onboarding shell + dynamic UI states.
8. Validate dark/light contrast and reduced motion.
9. Only after approval, migrate productive screens incrementally.

No mass rewrite. No visual migration before the Lab is approved.


## 11. Forte Foundation extraction boundary

This implementation is intentionally **product-first and Foundation-ready**.

- SevenEF is the proving ground and canonical preview.
- Reusable semantic surfaces, motion primitives, accessibility rules, theme adapters and brand adapters are candidates for a future Forte Foundation block.
- SevenEF wordmark/favicon, Mr. Forte narrative/assets, vertical identities and product copy remain product-specific adapters/presets.
- Foundation remains reuse-by-copy with version/provenance; this work must not introduce a central runtime dependency.

The detailed promotion contract lives in [foundation-promotion-contract.md](./foundation-promotion-contract.md).
