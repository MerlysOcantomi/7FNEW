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
  MessageSquarePlus,
  Upload,
} from "lucide-react"

interface DashboardData {
  stats: {
    totalProyectos: number
    proyectosActivos: number
    totalFacturas: number
    facturasPendientes: number
    tareasAbiertas: number
    totalDocumentos: number
    solicitudesAbiertas: number
    totalAssets: number
  }
  proyectosRecientes: any[]
  facturasRecientes: any[]
  tareasAbiertas: any[]
  ultimosAssets: any[]
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
          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/cliente/solicitudes"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1f2937] transition-colors justify-center"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New request
            </Link>
            <Link
              href="/cliente/archivos"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors justify-center"
            >
              <Upload className="h-4 w-4" />
              Upload file
            </Link>
          </div>

          {/* Stats */}
          <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FolderKanban}
              label="Active projects"
              value={data.stats.proyectosActivos}
              total={data.stats.totalProyectos}
            />
            <StatCard
              icon={FileText}
              label="Outstanding invoices"
              value={data.stats.facturasPendientes}
              total={data.stats.totalFacturas}
            />
            <StatCard
              icon={MessageSquarePlus}
              label="Open requests"
              value={data.stats.solicitudesAbiertas}
            />
            <StatCard
              icon={Files}
              label="Files"
              value={data.stats.totalAssets + data.stats.totalDocumentos}
            />
          </div>

          {/* Recent projects */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Your recent projects
              </h2>
              <Link
                href="/cliente/proyecto"
                className="flex items-center gap-1 text-xs font-medium text-[#1a3a5c] hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data.proyectosRecientes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                No projects yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.proyectosRecientes.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/cliente/proyecto/${p.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {p.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.descripcion?.slice(0, 60) || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {p.progreso != null && (
                        <span className="text-xs text-gray-500">
                          {p.progreso}%
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          estadoColors[p.estado] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Invoices + tasks */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Invoices */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Your recent invoices
                </h2>
                <Link
                  href="/cliente/facturas"
                  className="flex items-center gap-1 text-xs font-medium text-[#1a3a5c] hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {data.facturasRecientes.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No invoices yet
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.facturasRecientes.map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          #{f.numero}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(f.fechaEmision).toLocaleDateString(
                            "en-US"
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">
                          CHF{" "}
                          {f.total?.toLocaleString("de-CH", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            estadoColors[f.estado] ||
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {f.estado}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Your open tasks
                </h2>
              </div>
              {data.tareasAbiertas.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No open tasks
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.tareasAbiertas.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {t.titulo}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.fechaLimite
                            ? `Due date: ${new Date(
                                t.fechaLimite
                              ).toLocaleDateString("en-US")}`
                            : "No due date"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          estadoColors[t.estado] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
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

function StatCard({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: any
  label: string
  value: number
  total?: number
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a3a5c]/10">
          <Icon className="h-5 w-5 text-[#1a3a5c]" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">
            {value}
            {total != null && (
              <span className="text-sm font-normal text-gray-400">
                {" "}
                / {total}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}
