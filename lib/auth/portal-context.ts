import { db } from "@/lib/db"
import { getClientSessionFromCookies } from "@/lib/auth/client-session"
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace"

export interface PortalContext {
  clienteId: string
  workspaceId: string
  portalUserId: string
  email: string
  nombre: string
}

export async function getRequiredPortalContext(): Promise<PortalContext | null> {
  const session = await getClientSessionFromCookies()
  if (!session) return null

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: { workspaceId: true },
  })

  const workspaceId = cliente?.workspaceId ?? DEFAULT_WORKSPACE_ID

  return {
    clienteId: session.clienteId,
    workspaceId,
    portalUserId: session.clientAuthId,
    email: session.email,
    nombre: session.nombre,
  }
}
