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
  planificacion: "bg-blue-100 text-blue-700",
  en_progreso: "bg-amber-100 text-amber-700",
  completado: "bg-green-100 text-green-700",
  pausado: "bg-gray-100 text-gray-600",
  pendiente: "bg-yellow-100 text-yellow-700",
  completada: "bg-green-100 text-green-700",
  borrador: "bg-gray-100 text-gray-600",
  enviada: "bg-blue-100 text-blue-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
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
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !proyecto || proyecto.error ? (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-500">Proyecto no encontrado</p>
          <Link href="/cliente/proyecto" className="mt-2 text-sm text-[#1a3a5c] hover:underline">
            Volver a proyectos
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <Link href="/cliente/proyecto" className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" /> Proyectos
            </Link>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{proyecto.nombre}</h1>
                <p className="mt-1 text-sm text-gray-500">{proyecto.descripcion || "Sin descripcion"}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${estadoColors[proyecto.estado] || "bg-gray-100 text-gray-600"}`}>
                {proyecto.estado}
              </span>
            </div>
          </div>

          {/* Progress */}
          {proyecto.progreso != null && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Progreso</span>
                <span className="text-sm font-semibold text-[#1a3a5c]">{proyecto.progreso}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full bg-[#1a3a5c] transition-all"
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
              <div className="divide-y divide-gray-100">
                {proyecto.tareas.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.titulo}</p>
                      <p className="text-xs text-gray-500">{t.prioridad}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[t.estado] || "bg-gray-100 text-gray-600"}`}>
                      {t.estado}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay tareas</p>
            )}
          </Section>

          {/* Facturas */}
          <Section title="Facturas" icon={FileText} count={proyecto.facturas?.length || 0}>
            {proyecto.facturas?.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {proyecto.facturas.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">#{f.numero}</p>
                      <p className="text-xs text-gray-500">{new Date(f.fechaEmision).toLocaleDateString("es")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600"}`}>
                        {f.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay facturas</p>
            )}
          </Section>

          {/* Documentos */}
          <Section title="Documentos" icon={Files} count={proyecto.documentos?.length || 0}>
            {proyecto.documentos?.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {proyecto.documentos.map((d: any) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.nombre}</p>
                      <p className="text-xs text-gray-500">{d.tipo}</p>
                    </div>
                    <span className="text-xs text-[#1a3a5c]">Descargar</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay documentos</p>
            )}
          </Section>
        </div>
      )}
    </ClientPortalShell>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <Icon className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{count}</span>
      </div>
      {children}
    </div>
  )
}
