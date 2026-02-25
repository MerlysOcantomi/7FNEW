"use client"

import { useEffect, useState } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { FileText, Loader2, Download } from "lucide-react"

const estadoColors: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-600 rounded-md font-medium",
  pendiente: "bg-amber-100 text-amber-700 rounded-md font-medium",
  enviada: "bg-primary/10 text-primary rounded-md font-medium",
  pagada: "bg-green-100 text-green-700 rounded-md font-medium",
  vencida: "bg-red-100 text-red-700 rounded-md font-medium",
  cancelada: "bg-red-100 text-red-600 rounded-md font-medium",
}

export default function ClienteFacturasPage() {
  const [facturas, setFacturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    fetch("/api/cliente/facturas")
      .then((r) => r.json())
      .then((data) => setFacturas(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter
    ? facturas.filter((f) => f.estado === filter)
    : facturas

  const totalPendiente = facturas
    .filter((f) => ["pendiente", "enviada"].includes(f.estado))
    .reduce((acc, f) => acc + (f.total || 0), 0)

  const totalPagado = facturas
    .filter((f) => f.estado === "pagada")
    .reduce((acc, f) => acc + (f.total || 0), 0)

  return (
    <ClientPortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Mis Facturas</h1>
          <p className="text-sm text-muted-foreground">Historial completo de facturacion</p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <p className="text-xs text-muted-foreground">Total facturas</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{facturas.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <p className="text-xs text-muted-foreground">Pendiente de pago</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              CHF {totalPendiente.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm p-5">
            <p className="text-xs text-muted-foreground">Total pagado</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">
              CHF {totalPagado.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["", "pendiente", "enviada", "pagada", "vencida"].map((estado) => (
            <button
              key={estado || "all"}
              onClick={() => setFilter(estado)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === estado
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {estado || "Todas"}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card shadow-sm px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No hay facturas</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numero</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Proyecto</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimiento</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((f: any) => (
                    <tr key={f.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-5 py-4 text-sm font-medium text-foreground group-hover:text-primary">#{f.numero}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{new Date(f.fechaEmision).toLocaleDateString("es")}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{f.proyecto?.nombre || "—"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString("es") : "—"}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-foreground">
                        CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                          {f.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {filtered.map((f: any) => (
                <div key={f.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">#{f.numero}</span>
                    <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600 rounded-md font-medium"}`}>
                      {f.estado}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{new Date(f.fechaEmision).toLocaleDateString("es")}</span>
                    <span className="text-sm font-semibold text-foreground">
                      CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
