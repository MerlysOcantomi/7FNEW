import { db } from "@core/db"
import { getClientSessionFromCookies } from "@core/auth/client-session"

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

  if (!cliente?.workspaceId) return null

  return {
    clienteId: session.clienteId,
    workspaceId: cliente.workspaceId,
    portalUserId: session.clientAuthId,
    email: session.email,
    nombre: session.nombre,
  }
}
