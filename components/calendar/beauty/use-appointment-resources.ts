"use client"

import { useEffect, useState } from "react"
import { resolveServiceCatalog, type ServiceCatalogItem } from "@core/services/catalog"

export interface ClientOption {
  id: string
  nombre: string
}

export interface ServiceOption extends ServiceCatalogItem {}

export interface ProfessionalOption {
  userId: string
  nombre: string | null
  email: string
  avatar: string | null
  role: string
}

export interface AppointmentResources {
  clients: ClientOption[]
  services: ServiceOption[]
  professionals: ProfessionalOption[]
  loading: boolean
}

async function readEnvelope<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const json = await res.json()
  return (json?.data ?? json) as T
}

/**
 * Real appointment resources from canonical workspace sources:
 * - Cliente
 * - serviceCatalog V2
 * - WorkspaceMember/User
 *
 * No duplicated Beauty-only directory is introduced.
 */
export function useAppointmentResources(enabled: boolean): AppointmentResources {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    setLoading(true)

    Promise.allSettled([
      fetch("/api/clientes?estado=activo&pageSize=200", { credentials: "include" }).then((r) =>
        readEnvelope<Array<{ id: string; nombre: string }>>(r),
      ),
      fetch("/api/workspace/services", { credentials: "include" }).then((r) =>
        readEnvelope<{ serviceCatalog?: unknown }>(r),
      ),
      fetch("/api/inbox/workspace-members", { credentials: "include" }).then((r) =>
        readEnvelope<ProfessionalOption[]>(r),
      ),
    ]).then(([clientsRes, servicesRes, professionalsRes]) => {
      if (!active) return

      if (clientsRes.status === "fulfilled" && Array.isArray(clientsRes.value)) {
        setClients(
          clientsRes.value
            .filter((c) => c && typeof c.id === "string")
            .map((c) => ({ id: c.id, nombre: c.nombre })),
        )
      }

      if (servicesRes.status === "fulfilled" && servicesRes.value) {
        setServices(
          resolveServiceCatalog(servicesRes.value.serviceCatalog).filter((service) => service.active),
        )
      }

      if (
        professionalsRes.status === "fulfilled" &&
        Array.isArray(professionalsRes.value)
      ) {
        setProfessionals(
          professionalsRes.value.filter(
            (member) => member && typeof member.userId === "string" && typeof member.email === "string",
          ),
        )
      }

      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [enabled])

  return { clients, services, professionals, loading }
}
