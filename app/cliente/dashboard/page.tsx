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
  planificacion: "bg-primary/10 text-primary rounded-md font-medium",
  "en_progreso": "bg-amber-100 text-amber-700 rounded-md font-medium",
  en_progreso: "bg-amber-100 text-amber-700 rounded-md font-medium",
  completado: "bg-green-100 text-green-700 rounded-md font-medium",
  pausado: "bg-gray-100 text-gray-600 rounded-md font-medium",
  pendiente: "bg-amber-100 text-amber-700 rounded-md font-medium",
  enviada: "bg-primary/10 text-primary rounded-md font-medium",
  pagada: "bg-green-100 text-green-700 rounded-md font-medium",
  vencida: "bg-red-100 text-red-700 rounded-md font-medium",
  borrador: "bg-gray-100 text-gray-600 rounded-md font-medium",
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Proyectos recientes</h2>
              <Link href="/cliente/proyecto" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.proyectosRecientes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay proyectos</p>
            ) : (
              <div className="divide-y divide-border">
                {data.proyectosRecientes.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/cliente/proyecto/${p.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">{p.descripcion?.slice(0, 60) || "Sin descripcion"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.progreso != null && (
                        <span className="text-xs text-muted-foreground">{p.progreso}%</span>
                      )}
                      <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[p.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
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
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Facturas recientes</h2>
                <Link href="/cliente/facturas" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.facturasRecientes.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay facturas</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.facturasRecientes.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">#{f.numero}</p>
                        <p className="text-xs text-muted-foreground">{new Date(f.fechaEmision).toLocaleDateString("es")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">
                          CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600"}`}>
                          {f.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tareas */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Tareas abiertas</h2>
              </div>
              {data.tareasAbiertas.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay tareas pendientes</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.tareasAbiertas.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.fechaLimite ? `Fecha limite: ${new Date(t.fechaLimite).toLocaleDateString("es")}` : "Sin fecha limite"}
                        </p>
                      </div>
                      <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[t.estado] || "bg-gray-100 text-gray-600"}`}>
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
    <div className="rounded-xl border border-border bg-card shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">
            {value}
            {total != null && <span className="text-sm font-normal text-muted-foreground"> / {total}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}
