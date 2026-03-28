"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Search,
  Download,
  Eye,
  X,
  ChevronDown,
  Sparkles,
  Calendar,
  CreditCard,
  Receipt,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  ExternalLink,
  Send,
  SlidersHorizontal,
} from "lucide-react"

/* ─────────── Types ─────────── */

type InvoiceStatus = "pagada" | "pendiente" | "vencida"

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Payment {
  date: string
  method: string
  amount: number
  reference: string
}

interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  total: number
  subtotal: number
  tax: number
  taxRate: number
  project?: string
  lineItems: LineItem[]
  payments: Payment[]
  notes: string
}

/* ─────────── Data ─────────── */

const invoices: Invoice[] = [
  {
    id: "inv-1",
    number: "INV-2026-001",
    issueDate: "Jan 5 2026",
    dueDate: "Feb 5 2026",
    status: "pagada",
    subtotal: 24000,
    tax: 3840,
    taxRate: 16,
    total: 27840,
    project: "Visual Identity Redesign",
    lineItems: [
      { description: "Logo design and visual identity", quantity: 1, unitPrice: 12000, total: 12000 },
      { description: "Brand manual (50 pages)", quantity: 1, unitPrice: 8000, total: 8000 },
      { description: "Corporate stationery (5 items)", quantity: 5, unitPrice: 800, total: 4000 },
    ],
    payments: [
      { date: "Jan 10 2026", method: "Bank transfer", amount: 13920, reference: "REF-88421" },
      { date: "Feb 2 2026", method: "Bank transfer", amount: 13920, reference: "REF-91205" },
    ],
    notes: "Payment split into two installments based on the commercial agreement.",
  },
  {
    id: "inv-2",
    number: "INV-2026-002",
    issueDate: "Feb 1 2026",
    dueDate: "Mar 3 2026",
    status: "pendiente",
    subtotal: 18500,
    tax: 2960,
    taxRate: 16,
    total: 21460,
    project: "Q1 Digital Campaign",
    lineItems: [
      { description: "Digital campaign strategy", quantity: 1, unitPrice: 6500, total: 6500 },
      { description: "Graphic asset design (12 items)", quantity: 12, unitPrice: 500, total: 6000 },
      { description: "Paid media management (1 month)", quantity: 1, unitPrice: 6000, total: 6000 },
    ],
    payments: [],
    notes: "Invoice issued at the start of the project. Due in 30 days.",
  },
  {
    id: "inv-3",
    number: "INV-2026-003",
    issueDate: "Feb 15 2026",
    dueDate: "Mar 15 2026",
    status: "pendiente",
    subtotal: 35000,
    tax: 5600,
    taxRate: 16,
    total: 40600,
    project: "Content Strategy",
    lineItems: [
      { description: "Content and competitor audit", quantity: 1, unitPrice: 8000, total: 8000 },
      { description: "Editorial strategy (6 months)", quantity: 1, unitPrice: 15000, total: 15000 },
      { description: "Monthly content calendar", quantity: 6, unitPrice: 2000, total: 12000 },
    ],
    payments: [],
    notes: "Long-term project. Billing will be monthly starting from the second delivery.",
  },
  {
    id: "inv-4",
    number: "INV-2025-018",
    issueDate: "Nov 15 2025",
    dueDate: "Dec 15 2025",
    status: "pagada",
    subtotal: 9800,
    tax: 1568,
    taxRate: 16,
    total: 11368,
    project: "Q1 Digital Campaign",
    lineItems: [
      { description: "Product photography (full session)", quantity: 1, unitPrice: 5800, total: 5800 },
      { description: "Photo editing and retouching", quantity: 1, unitPrice: 4000, total: 4000 },
    ],
    payments: [
      { date: "Nov 20 2025", method: "Credit card", amount: 11368, reference: "REF-76390" },
    ],
    notes: "",
  },
  {
    id: "inv-5",
    number: "INV-2025-012",
    issueDate: "Oct 1 2025",
    dueDate: "Oct 31 2025",
    status: "vencida",
    subtotal: 5200,
    tax: 832,
    taxRate: 16,
    total: 6032,
    lineItems: [
      { description: "Branding consulting (8 hours)", quantity: 8, unitPrice: 650, total: 5200 },
    ],
    payments: [],
    notes: "One-time consulting service. Overdue with no recorded payment.",
  },
]

/* ─────────── Helpers ─────────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const statusConfig: Record<InvoiceStatus, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  pagada: { label: "Paid", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  pendiente: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  vencida: { label: "Overdue", bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
}

function parseDisplayDate(d: string): string {
  return d
}

type SortKey = "date" | "total" | "status"

function sortInvoices(list: Invoice[], key: SortKey, asc: boolean): Invoice[] {
  return [...list].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case "date":
        cmp = new Date(parseDisplayDate(a.issueDate)).getTime() - new Date(parseDisplayDate(b.issueDate)).getTime()
        break
      case "total":
        cmp = a.total - b.total
        break
      case "status": {
        const order = { vencida: 0, pendiente: 1, pagada: 2 }
        cmp = order[a.status] - order[b.status]
        break
      }
    }
    return asc ? cmp : -cmp
  })
}

/* ─────────── Main Component ─────────── */

export function ClientBillingTab() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)

  let filtered = invoices.filter((inv) => {
    const matchSearch =
      search === "" ||
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.project && inv.project.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === "all" || inv.status === statusFilter
    return matchSearch && matchStatus
  })
  filtered = sortInvoices(filtered, sortKey, sortAsc)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  // Summary stats
  const totalPagado = invoices.filter((i) => i.status === "pagada").reduce((s, i) => s + i.total, 0)
  const totalPendiente = invoices.filter((i) => i.status === "pendiente").reduce((s, i) => s + i.total, 0)
  const totalVencido = invoices.filter((i) => i.status === "vencida").reduce((s, i) => s + i.total, 0)

  // If viewing a detail
  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary cards ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <SummaryCard
          label="Paid Billing"
          amount={totalPagado}
          icon={CheckCircle2}
          accentClass="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          label="Pending Billing"
          amount={totalPendiente}
          icon={Clock}
          accentClass="bg-amber-100 text-amber-700"
        />
        <SummaryCard
          label="Overdue Billing"
          amount={totalVencido}
          icon={AlertCircle}
          accentClass="bg-red-100 text-red-700"
        />
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Billing</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
            {statusFilter !== "all" && " filtered"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showAIPanel
                ? "border-foreground/20 bg-[var(--tab-ai)] text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        </div>
      </div>

      {/* ── AI Panel ── */}
      {showAIPanel && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
                <Sparkles className="h-4 w-4 text-foreground/70" />
              </div>
              <p className="text-sm font-semibold text-foreground">Billing AI Assistant</p>
            </div>
            <button
              onClick={() => setShowAIPanel(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The AI Assistant analyzes the client's billing history to provide insights and quick actions.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <AIBillingAction
              title="Explain Invoice"
              description="Break down an invoice in simple language for the client."
            />
            <AIBillingAction
              title="Summarize Charges"
              description="Generate an executive summary of all active charges."
            />
            <AIBillingAction
              title="Detect Inconsistencies"
              description="Review amounts, dates, and statuses for possible errors."
            />
            <AIBillingAction
              title="Generate Reminder"
              description="Prepare a follow-up message for pending invoices."
            />
          </div>

          {/* AI insight preview */}
          <div className="rounded-lg border border-border bg-background p-4 flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0 mt-0.5">
              <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">Automatic Summary</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                The client has {invoices.length} recorded invoices. {formatCurrency(totalPagado)} collected,
                {` ${formatCurrency(totalPendiente)} pending, and ${formatCurrency(totalVencido)} overdue.`}
                {totalVencido > 0 && " It is recommended to send a payment reminder for overdue invoice INV-2025-012."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filters ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by number or project..."
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showFilters
                ? "border-foreground/20 bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["all", "pagada", "pendiente", "vencida"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {s === "all" ? "All" : statusConfig[s].label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:inline">
                Sort:
              </span>
              <SortButton label="Date" sortKey="date" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortButton label="Amount" sortKey="total" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
              <SortButton label="Status" sortKey="status" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
            </div>
          </div>
        )}
      </div>

      {/* ── Invoice list ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No invoices found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting the filters or search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              onView={() => setSelectedInvoice(inv)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────── Summary Card ─────────── */

function SummaryCard({
  label,
  amount,
  icon: Icon,
  accentClass,
}: {
  label: string
  amount: number
  icon: typeof CheckCircle2
  accentClass: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0", accentClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground mt-1">{formatCurrency(amount)}</p>
      </div>
    </div>
  )
}

/* ─────────── Invoice Card ─────────── */

function InvoiceCard({ invoice, onView }: { invoice: Invoice; onView: () => void }) {
  const sc = statusConfig[invoice.status]
  const StatusIcon = sc.icon

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-shadow hover:shadow-sm">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tab-billing)] flex-shrink-0">
            <Receipt className="h-5 w-5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{invoice.number}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.issueDate}</p>
          </div>
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0", sc.bg, sc.text)}>
          <StatusIcon className="h-3 w-3" />
          {sc.label}
        </span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {invoice.project && (
          <span className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            {invoice.project}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          Due: {invoice.dueDate}
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-lg font-semibold text-foreground">{formatCurrency(invoice.total)}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Invoice Detail ─────────── */

function InvoiceDetail({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const sc = statusConfig[invoice.status]
  const StatusIcon = sc.icon

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        Back to billing
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tab-billing)] flex-shrink-0">
            <Receipt className="h-6 w-6 text-foreground/60" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{invoice.number}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", sc.bg, sc.text)}>
                <StatusIcon className="h-3 w-3" />
                {sc.label}
              </span>
              {invoice.project && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {invoice.project}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          {invoice.status !== "pagada" && (
            <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
              <CreditCard className="h-4 w-4" />
              Pay Now
            </button>
          )}
        </div>
      </div>

      {/* Dates & amounts summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <DetailField label="Issue Date" value={invoice.issueDate} />
        <DetailField label="Due Date" value={invoice.dueDate} />
        <DetailField label="Subtotal" value={formatCurrency(invoice.subtotal)} />
        <DetailField label="Total" value={formatCurrency(invoice.total)} highlight />
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Charge Breakdown</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Qty.</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Unit Price</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.lineItems.map((item, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-foreground">{item.description}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground text-right">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={3} className="px-5 py-3 text-sm text-muted-foreground text-right">Subtotal</td>
                <td className="px-5 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-5 py-3 text-sm text-muted-foreground text-right">
                  Tax ({invoice.taxRate}%)
                </td>
                <td className="px-5 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(invoice.tax)}</td>
              </tr>
              <tr className="border-t border-border bg-muted/30">
                <td colSpan={3} className="px-5 py-4 text-sm font-semibold text-foreground text-right">Total</td>
                <td className="px-5 py-4 text-base font-semibold text-foreground text-right">{formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile stacked view */}
        <div className="sm:hidden divide-y divide-border">
          {invoice.lineItems.map((item, i) => (
            <div key={i} className="px-5 py-4 flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">{item.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                <span className="font-medium text-foreground">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
          <div className="px-5 py-4 flex flex-col gap-2 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>IVA ({invoice.taxRate}%)</span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Payment History</h3>
        </div>
        {invoice.payments.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No payments recorded for this invoice.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {invoice.payments.map((payment, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {payment.date} &middot; {payment.method}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                  {payment.reference}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{invoice.notes}</p>
        </div>
      )}

      {/* Pay Now CTA (future integration space) */}
      {invoice.status !== "pagada" && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Online Payment</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Soon you will be able to pay your invoices directly from this space using credit card, bank transfer, or SPEI.
            </p>
          </div>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg bg-foreground/50 px-4 py-2.5 text-sm font-medium text-background cursor-not-allowed"
          >
            <CreditCard className="h-4 w-4" />
            Pay {formatCurrency(invoice.total)}
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────── Small shared pieces ─────────── */

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", highlight ? "text-foreground text-base font-semibold" : "text-foreground")}>
        {value}
      </p>
    </div>
  )
}

function SortButton({
  label,
  sortKey,
  currentKey,
  asc,
  onToggle,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  asc: boolean
  onToggle: (key: SortKey) => void
}) {
  const isActive = sortKey === currentKey
  return (
    <button
      onClick={() => onToggle(sortKey)}
      className={cn(
        "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
      {isActive && (
        <ArrowUpDown className={cn("h-3 w-3 transition-transform", !asc && "rotate-180")} />
      )}
    </button>
  )
}

function AIBillingAction({ title, description }: { title: string; description: string }) {
  return (
    <button className="rounded-xl border border-border bg-background p-4 text-left transition-shadow hover:shadow-sm flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  )
}
