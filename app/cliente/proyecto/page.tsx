"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { FolderKanban, ArrowRight, Loader2 } from "lucide-react"

const estadoColors: Record<string, string> = {
  planificacion: "bg-primary/10 text-primary rounded-md font-medium",
  en_progreso: "bg-amber-100 text-amber-700 rounded-md font-medium",
  completado: "bg-green-100 text-green-700 rounded-md font-medium",
  pausado: "bg-gray-100 text-gray-600 rounded-md font-medium",
  cancelado: "bg-red-100 text-red-700 rounded-md font-medium",
}

export default function ClienteProyectosPage() {
  const [proyectos, setProyectos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/cliente/proyectos")
      .then((r) => r.json())
      .then((data) => setProyectos(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <ClientPortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Mis Proyectos</h1>
          <p className="text-sm text-muted-foreground">Todos los proyectos asociados a tu cuenta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : proyectos.length === 0 ? (
          <div className="rounded-xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <FolderKanban className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No hay proyectos</p>
            <p className="mt-1 text-xs text-muted-foreground">Aun no tienes proyectos asignados</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((p: any) => (
              <Link
                key={p.id}
                href={`/cliente/proyecto/${p.id}`}
                className="group rounded-xl border border-border bg-card shadow-sm p-5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
                    {p.nombre}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {p.descripcion || "Sin descripcion"}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                    {p.estado}
                  </span>
                  {p.progreso != null && (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${p.progreso}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.progreso}%</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {p.tareas?.length || 0} tareas
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
