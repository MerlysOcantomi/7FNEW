import { redirect } from "next/navigation"
import { getSessionFromCookies } from "@/core/auth/session"
import { getRequiredWorkspaceId } from "@/core/workspace-context"
import { checkMembership } from "@/core/workspace"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { EmailConnectionsManager } from "@/components/administracion/email-connections"

export default async function CanalesPage() {
  const session = await getSessionFromCookies()
  if (!session) redirect("/login")

  let workspaceId = ""
  let wsRole = "VIEWER"

  try {
    workspaceId = await getRequiredWorkspaceId()
    const member = await checkMembership(session.userId, workspaceId)
    wsRole = (member?.role as string) ?? "VIEWER"
  } catch {
    redirect("/login")
  }

  if (!["OWNER", "ADMIN"].includes(wsRole)) {
    redirect("/administracion")
  }

  return (
    <AppShell
      currentSection="administracion"
      breadcrumbs={[
        { label: "7F" },
        { label: "Administración", href: "/administracion" },
        { label: "Canales de email" },
      ]}
    >
      <SectionPage
        title="Canales de email"
        description="Conecta cuentas de email para enviar y recibir mensajes desde el inbox del workspace."
      >
        <EmailConnectionsManager workspaceId={workspaceId} />
      </SectionPage>
    </AppShell>
  )
}
