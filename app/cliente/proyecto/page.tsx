"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { FolderKanban, ArrowRight, Loader2 } from "lucide-react"

const estadoColors: Record<string, string> = {
  planificacion: "bg-blue-100 text-blue-700",
  en_progreso: "bg-amber-100 text-amber-700",
  completado: "bg-green-100 text-green-700",
  pausado: "bg-gray-100 text-gray-600",
  cancelado: "bg-red-100 text-red-700",
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
          <h1 className="text-lg font-semibold text-gray-900">My projects</h1>
          <p className="text-sm text-gray-500">All projects linked to your account</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : proyectos.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <FolderKanban className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">No projects yet</p>
            <p className="mt-1 text-xs text-gray-500">You do not have any assigned projects yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proyectos.map((p: any) => (
              <Link
                key={p.id}
                href={`/cliente/proyecto/${p.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#1a3a5c]">
                    {p.nombre}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#1a3a5c]" />
                </div>
                <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                  {p.descripcion || "No description"}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600"}`}>
                    {p.estado}
                  </span>
                  {p.progreso != null && (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-[#1a3a5c]"
                          style={{ width: `${p.progreso}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{p.progreso}%</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  {p.tareas?.length || 0} tasks
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
