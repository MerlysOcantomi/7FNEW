"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClientPortalShell } from "@/components/client-portal-shell"
import {
  FolderKanban,
  FileText,
  CheckSquare,
  Files,
  ArrowRight,
  Loader2,
} from "lucide-react"

interface DashboardData {
  stats: {
    totalProyectos: number
    proyectosActivos: number
    totalFacturas: number
    facturasPendientes: number
    tareasAbiertas: number
    totalDocumentos: number
  }
  proyectosRecientes: any[]
  facturasRecientes: any[]
  tareasAbiertas: any[]
}

const estadoColors: Record<string, string> = {
  planificacion: "bg-blue-100 text-blue-700",
  en_progreso: "bg-amber-100 text-amber-700",
  completado: "bg-green-100 text-green-700",
  pausado: "bg-gray-100 text-gray-600",
  pendiente: "bg-yellow-100 text-yellow-700",
  enviada: "bg-blue-100 text-blue-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
  borrador: "bg-gray-100 text-gray-600",
}

export default function ClienteDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/cliente/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <ClientPortalShell>
      {loading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FolderKanban} label="Proyectos activos" value={data.stats.proyectosActivos} total={data.stats.totalProyectos} />
            <StatCard icon={FileText} label="Facturas pendientes" value={data.stats.facturasPendientes} total={data.stats.totalFacturas} />
            <StatCard icon={CheckSquare} label="Tareas abiertas" value={data.stats.tareasAbiertas} />
            <StatCard icon={Files} label="Documentos" value={data.stats.totalDocumentos} />
          </div>

          {/* Proyectos recientes */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Proyectos recientes</h2>
              <Link href="/cliente/proyecto" className="flex items-center gap-1 text-xs font-medium text-[#1a3a5c] hover:underline">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.proyectosRecientes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay proyectos</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.proyectosRecientes.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/cliente/proyecto/${p.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-500">{p.descripcion?.slice(0, 60) || "Sin descripcion"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.progreso != null && (
                        <span className="text-xs text-gray-500">{p.progreso}%</span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600"}`}>
                        {p.estado}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Facturas + Tareas */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Facturas */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Facturas recientes</h2>
                <Link href="/cliente/facturas" className="flex items-center gap-1 text-xs font-medium text-[#1a3a5c] hover:underline">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.facturasRecientes.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No hay facturas</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.facturasRecientes.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">#{f.numero}</p>
                        <p className="text-xs text-gray-500">{new Date(f.fechaEmision).toLocaleDateString("es")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600"}`}>
                          {f.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tareas */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Tareas abiertas</h2>
              </div>
              {data.tareasAbiertas.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No hay tareas pendientes</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.tareasAbiertas.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.titulo}</p>
                        <p className="text-xs text-gray-500">
                          {t.fechaLimite ? `Fecha limite: ${new Date(t.fechaLimite).toLocaleDateString("es")}` : "Sin fecha limite"}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[t.estado] || "bg-gray-100 text-gray-600"}`}>
                        {t.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ClientPortalShell>
  )
}

function StatCard({ icon: Icon, label, value, total }: { icon: any; label: string; value: number; total?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a3a5c]/10">
          <Icon className="h-5 w-5 text-[#1a3a5c]" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {value}
            {total != null && <span className="text-sm font-normal text-gray-400"> / {total}</span>}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}
