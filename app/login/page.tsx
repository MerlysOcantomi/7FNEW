import { redirect } from "next/navigation"
import { isLabDeployment } from "@core/lab/gate"
import { LoginClient } from "./login-client"

/**
 * `/login` (DEV-PREVIEW-01D).
 *
 * On the authorized Mr Forte Lab deployment there is no Google/dev login — the
 * only way in is the Lab access key, so `/login` redirects to `/lab/enter`
 * (the Google button never renders). Everywhere else (production) this renders
 * the normal login unchanged. The decision is server-derived from the private
 * gate (project id verified), never a public variable.
 */

// Reads the gate (headers + private env) → never statically prerendered.
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await isLabDeployment()) redirect("/lab/enter")
  return <LoginClient />
}
