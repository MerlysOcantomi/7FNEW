"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { StatCard } from "@/components/stat-card"
import { useFetch } from "@/hooks/use-fetch"
import { DollarSign, TrendingUp, CreditCard, Receipt, Pencil, Trash2, Plus } from "lucide-react"
import { TransaccionForm } from "@/components/forms/transaccion-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { apiDelete } from "@/lib/api-client"
import { toast } from "sonner"
import { RoleGate, CanEdit, CanDelete } from "@/components/role-gate"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return value
  }
}

export default function FinanzasPage() {
  const { data: apiData, loading, error, refetch } = useFetch<any>("/api/finanzas")
  const transactions = Array.isArray(apiData) ? apiData : []
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  const stats = useMemo(() => {
    const ingresos = transactions
      .filter((t: any) => t.tipo === "ingreso")
      .reduce((sum: number, t: any) => sum + (Number(t.monto) || 0), 0)
    const gastos = transactions
      .filter((t: any) => t.tipo === "gasto")
      .reduce((sum: number, t: any) => sum + (Number(t.monto) || 0), 0)
    const balance = ingresos - gastos
    return { ingresos, gastos, balance }
  }, [transactions])

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/finanzas/${deleteItem.id}`)
      toast.success("Transacción eliminada")
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  return (
    <AppShell
      currentSection="finanzas"
      breadcrumbs={[{ label: "7F" }, { label: "Finanzas" }]}
    >
      <SectionPage
        title="Finanzas"
        description="Control financiero de ingresos, egresos, facturacion y presupuestos."
      >
        <RoleGate requiredRole="admin">
        <div className="flex items-center justify-end gap-3">
          <CanEdit>
          <button
            onClick={() => { setEditingItem(null); setFormOpen(true) }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 whitespace-nowrap flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva transacción
          </button>
          </CanEdit>
          <Link href="/facturacion" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            Ver facturacion detallada →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Ingresos" value={formatCurrency(stats.ingresos)} icon={TrendingUp} color="#7C3AED" />
          <StatCard label="Egresos" value={formatCurrency(stats.gastos)} icon={CreditCard} color="#6D28D9" />
          <StatCard label="Utilidad neta" value={formatCurrency(stats.balance)} icon={DollarSign} color="#9333EA" />
          <StatCard label="Movimientos" value={String(transactions.length)} icon={Receipt} color="#64748B" />
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Movimientos Recientes</h2>
          </div>

          {loading && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          )}

          {!loading && error && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!loading && !error && transactions.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No hay movimientos.</p>
            </div>
          )}

          {!loading && !error && transactions.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Concepto</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo</th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha</th>
                      <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Monto</th>
                      <th className="px-5 py-3 w-20 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors group">
                        <td className="px-5 py-4 text-sm font-medium text-foreground group-hover:text-primary">{tx.descripcion ?? "—"}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tx.tipo === "ingreso" ? "bg-primary/10 text-primary" : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"}`}>
                            {tx.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(tx.fecha)}</td>
                        <td className={`px-5 py-4 text-sm font-bold text-right ${tx.tipo === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          {tx.tipo === "ingreso" ? "+" : "-"}{formatCurrency(Math.abs(Number(tx.monto) || 0))}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setEditingItem(tx); setFormOpen(true) }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteItem(tx)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-destructive transition-colors"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col divide-y divide-border md:hidden">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="p-4 flex flex-col gap-1.5 hover:bg-muted/40 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary flex-1 min-w-0">{tx.descripcion ?? "—"}</p>
                      <p className={`text-sm font-bold flex-shrink-0 ${tx.tipo === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {tx.tipo === "ingreso" ? "+" : "-"}{formatCurrency(Math.abs(Number(tx.monto) || 0))}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditingItem(tx); setFormOpen(true) }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteItem(tx)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-destructive transition-colors"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tx.tipo === "ingreso" ? "bg-primary/10 text-primary" : "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"}`}>
                        {tx.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(tx.fecha)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <TransaccionForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar transacción"
          description={`¿Seguro que quieres eliminar esta transacción de $${deleteItem?.monto != null ? Number(deleteItem.monto).toLocaleString("es-MX") : "—"}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
        </RoleGate>
      </SectionPage>
    </AppShell>
  )
}
