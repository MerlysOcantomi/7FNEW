"use client"

import { useActionState } from "react"
import { enterLabAction, type LabEnterState } from "./actions"

const INITIAL: LabEnterState = { error: null }

const ERROR_MESSAGES: Record<NonNullable<LabEnterState["error"]>, string> = {
  "invalid-key": "Access could not be verified.",
  "not-ready": "The preview environment is not ready.",
}

/**
 * Minimal access-key form (DEV-PREVIEW-01B). Uses `useActionState` so the
 * generic error renders without any query parameter. The key is a password
 * field, never persisted client-side.
 */
export function EnterForm() {
  const [state, action, pending] = useActionState(enterLabAction, INITIAL)
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="lab-key" className="text-sm font-medium">
          Access key
        </label>
        <input
          id="lab-key"
          name="key"
          type="password"
          autoComplete="off"
          autoFocus
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[state.error]}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Enter Lab"}
      </button>
    </form>
  )
}
