"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ClientPortalShell } from "@/components/client-portal-shell"
import {
  ArrowLeft,
  CheckSquare,
  FileText,
  Files,
  Loader2,
} from "lucide-react"

const estadoColors: Record<string, string> = {
  planificacion: "bg-primary/10 text-primary rounded-md font-medium",
  en_progreso: "bg-amber-100 text-amber-700 rounded-md font-medium",
  completado: "bg-green-100 text-green-700 rounded-md font-medium",
  pausado: "bg-gray-100 text-gray-600 rounded-md font-medium",
  pendiente: "bg-amber-100 text-amber-700 rounded-md font-medium",
  completada: "bg-green-100 text-green-700 rounded-md font-medium",
  borrador: "bg-gray-100 text-gray-600 rounded-md font-medium",
  enviada: "bg-primary/10 text-primary rounded-md font-medium",
  pagada: "bg-green-100 text-green-700 rounded-md font-medium",
  vencida: "bg-red-100 text-red-700 rounded-md font-medium",
}

export default function ClienteProyectoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [proyecto, setProyecto] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/proyectos/${id}`)
      .then((r) => r.json())
      .then(setProyecto)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  return (
    <ClientPortalShell>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !proyecto || proyecto.error ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Proyecto no encontrado</p>
          <Link href="/cliente/proyecto" className="mt-2 text-sm text-primary hover:text-primary/80">
            Volver a proyectos
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <Link href="/cliente/proyecto" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Proyectos
            </Link>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">{proyecto.nombre}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{proyecto.descripcion || "Sin descripcion"}</p>
              </div>
              <span className={`rounded-md px-3 py-1 text-xs font-medium ${estadoColors[proyecto.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                {proyecto.estado}
              </span>
            </div>
          </div>

          {/* Progress */}
          {proyecto.progreso != null && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Progreso</span>
                <span className="text-sm font-semibold text-primary">{proyecto.progreso}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full bg-primary transition-all"
                  style={{ width: `${proyecto.progreso}%` }}
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="grid gap-4 sm:grid-cols-3">
            <InfoCard label="Fecha inicio" value={proyecto.fechaInicio ? new Date(proyecto.fechaInicio).toLocaleDateString("es") : "—"} />
            <InfoCard label="Fecha fin" value={proyecto.fechaFin ? new Date(proyecto.fechaFin).toLocaleDateString("es") : "—"} />
            <InfoCard label="Presupuesto" value={proyecto.presupuesto ? `CHF ${proyecto.presupuesto.toLocaleString("de-CH")}` : "—"} />
          </div>

          {/* Tareas */}
          <Section title="Tareas" icon={CheckSquare} count={proyecto.tareas?.length || 0}>
            {proyecto.tareas?.length > 0 ? (
              <div className="divide-y divide-border">
                {proyecto.tareas.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground">{t.prioridad}</p>
                    </div>
                    <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[t.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                      {t.estado}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay tareas</p>
            )}
          </Section>

          {/* Facturas */}
          <Section title="Facturas" icon={FileText} count={proyecto.facturas?.length || 0}>
            {proyecto.facturas?.length > 0 ? (
              <div className="divide-y divide-border">
                {proyecto.facturas.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">#{f.numero}</p>
                      <p className="text-xs text-muted-foreground">{new Date(f.fechaEmision).toLocaleDateString("es")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</span>
                        <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                        {f.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay facturas</p>
            )}
          </Section>

          {/* Documentos */}
          <Section title="Documentos" icon={Files} count={proyecto.documentos?.length || 0}>
            {proyecto.documentos?.length > 0 ? (
              <div className="divide-y divide-border">
                {proyecto.documentos.map((d: any) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary">{d.nombre}</p>
                      <p className="text-xs text-muted-foreground">{d.tipo}</p>
                    </div>
                    <span className="text-xs text-primary hover:text-primary/80">Descargar</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay documentos</p>
            )}
          </Section>
        </div>
      )}
    </ClientPortalShell>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  )
}
