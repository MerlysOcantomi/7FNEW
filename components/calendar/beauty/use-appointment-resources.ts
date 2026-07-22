"use client"

import { useEffect, useState } from "react"
import { activeServiceNames, resolveServiceCatalog } from "@core/services/catalog"

/**
 * Real pickers for the appointment form — clients and services, from the
 * existing sources (no local arrays):
 *   - clients  → GET /api/clientes (successResponse-wrapped Cliente[])
 *   - services → GET /api/workspace/services (bare `{ serviceCatalog }`, so it
 *     is fetched directly rather than through `useFetch`, which expects the
 *     success envelope)
 *
 * Professional assignment is intentionally NOT fetched here: `Evento` has no
 * staff column, so offering an assignment control would be a button that does
 * not persist. The Team source (`WorkspaceMember` via
 * `/api/inbox/workspace-members`) is identified and ready for the follow-up
 * persistence mission that adds `assignedMemberId`.
 *
 * Fetched only when the form opens (`enabled`), once per open.
 */
export interface ClientOption {
  id: string
  nombre: string
}

export interface ServiceOption {
  name: string
}

export interface AppointmentResources {
  clients: ClientOption[]
  services: ServiceOption[]
  loading: boolean
}

async function readEnvelope<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const json = await res.json()
  return (json?.data ?? json) as T
}

export function useAppointmentResources(enabled: boolean): AppointmentResources {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
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
    ]).then(([clientsRes, servicesRes]) => {
      if (!active) return
      if (clientsRes.status === "fulfilled" && Array.isArray(clientsRes.value)) {
        setClients(
          clientsRes.value
            .filter((c) => c && typeof c.id === "string")
            .map((c) => ({ id: c.id, nombre: c.nombre })),
        )
      }
      if (servicesRes.status === "fulfilled" && servicesRes.value) {
        // Reuse the shared catalog normalizer + helper — active service names
        // only, no local list.
        const catalog = resolveServiceCatalog(servicesRes.value.serviceCatalog)
        setServices(activeServiceNames(catalog).map((name) => ({ name })))
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [enabled])

  return { clients, services, loading }
}
