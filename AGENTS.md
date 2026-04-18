# 7F — Agent guidance

## App shell (authenticated workspace)

All work on layout, scroll, or viewport behavior for **authenticated** routes must follow the **App Shell Contract**:

**→ [docs/app-shell-contract.md](docs/app-shell-contract.md)**

Summary:

- Shell root: **viewport-bounded** (`fixed inset-0` pattern as in [`components/app-shell.tsx`](components/app-shell.tsx)); avoid new **`min-h-screen`-only** roots for core pages.
- **`main`**: primary **`overflow-y-auto`** scroll; use **`flex-1 min-h-0 max-h-full`** along the chain.
- **No document/body scroll** as the default for core workspace pages.
- Exceptions: split-view (Inbox), chat (Assistant), internal table/panel scroll — see the doc.

Do not regress **ContextShell** / legacy layouts without aligning them to this contract when touching those files.
