import type { ReactNode } from "react"
import { requireLabAccessSession } from "@core/lab/access-session"

/**
 * Reusable guard + shell for protected `/lab` surfaces (DEV-PREVIEW-01B).
 *
 * Level 2 enforcement, as a server component wrapper rather than a route-group
 * layout (Next 16 did not apply a `(protected)/layout.tsx` here, so the guard
 * lives in an explicit shell every protected page renders). It requires a valid
 * lab ACCESS SESSION — missing/invalid/expired → redirect to `/lab/enter` — and
 * appends the discreet exit control. It never reveals token details, never
 * mints a `7f-session`/`wf_workspace`, and never queries Prisma.
 *
 * Future protected lab pages (DEV-PREVIEW-01C) wrap their content in this
 * shell to inherit the exact same access guarantee without duplicating it.
 */
export async function LabProtectedShell({ children }: { children: ReactNode }) {
  await requireLabAccessSession()
  return (
    <div className="space-y-8">
      {children}
      <footer className="border-t border-border pt-4">
        <form action="/lab/exit" method="post">
          <button
            type="submit"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Exit lab
          </button>
        </form>
      </footer>
    </div>
  )
}
