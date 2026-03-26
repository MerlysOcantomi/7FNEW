"use client"

import { useEffect, useState } from "react"
import { ClientPortalShell } from "@/components/client-portal-shell"
import { FileText, Loader2, Download } from "lucide-react"

const estadoColors: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-600",
  pendiente: "bg-yellow-100 text-yellow-700",
  enviada: "bg-blue-100 text-blue-700",
  pagada: "bg-green-100 text-green-700",
  vencida: "bg-red-100 text-red-700",
  cancelada: "bg-red-100 text-red-600",
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
          <h1 className="text-lg font-semibold text-gray-900">My invoices</h1>
          <p className="text-sm text-gray-500">Complete billing history</p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">Total invoices</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{facturas.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">Awaiting payment</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              CHF {totalPendiente.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">Total paid</p>
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
                  ? "bg-[#1a3a5c] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {estado || "All"}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">No invoices yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Number</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Project</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due date</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((f: any) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">#{f.numero}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{new Date(f.fechaEmision).toLocaleDateString("en-US")}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{f.proyecto?.nombre || "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString("en-US") : "—"}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        CHF {f.total?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600"}`}>
                          {f.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 md:hidden">
              {filtered.map((f: any) => (
                <div key={f.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">#{f.numero}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoColors[f.estado] || "bg-gray-100 text-gray-600"}`}>
                      {f.estado}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{new Date(f.fechaEmision).toLocaleDateString("en-US")}</span>
                    <span className="text-sm font-semibold text-gray-900">
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
