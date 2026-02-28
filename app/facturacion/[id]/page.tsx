"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { cn } from "@/lib/utils";
import {
  Download, Send, CheckCircle2, AlertTriangle, Clock,
  FileText, Building2, Calendar, Hash, Paperclip,
  ArrowUpRight, CreditCard, Upload, StickyNote,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = "Pagada" | "Pendiente" | "Vencida" | "Borrador";

interface LineItem {
  description: string;
  qty: number;
  unitPrice: string;
  tax: string;
  total: string;
}

interface Payment {
  date: string;
  method: string;
  amount: string;
  reference: string;
  type: "paid" | "partial";
}

interface PaymentEvent {
  date: string;
  event: string;
  amount?: string;
  type: "issued" | "reminder" | "paid" | "overdue" | "draft";
}

interface InvoiceData {
  id: string;
  client: string;
  clientId: string;
  project: string;
  projectId: string;
  status: InvoiceStatus;
  issued: string;
  due: string;
  subtotal: string;
  tax: string;
  total: string;
  totalRaw: number;
  paidRaw: number;
  paymentMethod: string;
  observations: string;
  lineItems: LineItem[];
  payments: Payment[];
  history: PaymentEvent[];
  notes: string;
  attachments: { name: string; size: string; generated?: boolean }[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const INVOICE_DATA: Record<string, InvoiceData> = {
  "INV-0044": {
    id: "INV-0044",
    client: "Vertex Capital",
    clientId: "c3",
    project: "Delta Infrastructure",
    projectId: "p3",
    status: "Vencida",
    issued: "10 feb 2025",
    due: "28 feb 2025",
    subtotal: "$69.565",
    tax: "$5.435",
    total: "$75.000",
    totalRaw: 75000,
    paidRaw: 0,
    paymentMethod: "Transferencia bancaria",
    observations: "Condiciones acordadas en contrato Marco 2024. IVA incluido. Pago dentro de los 30 días de emisión.",
    lineItems: [
      { description: "Fase 1 — Evaluación de Centro de Datos y Planificación de Arquitectura", qty: 1, unitPrice: "$32.000", tax: "7%", total: "$32.000" },
      { description: "Arquitecto Senior — 120 horas a $195/h", qty: 120, unitPrice: "$195", tax: "7%", total: "$23.400" },
      { description: "Paquete de Documentación de Auditoría de Infraestructura", qty: 1, unitPrice: "$8.165", tax: "7%", total: "$8.165" },
      { description: "Gastos de viaje y presenciales", qty: 1, unitPrice: "$6.000", tax: "0%", total: "$6.000" },
    ],
    payments: [],
    history: [
      { date: "10 feb 2025", event: "Factura emitida y entregada a T. Larsen (Cuentas a Pagar)", type: "issued" },
      { date: "18 feb 2025", event: "Confirmación de pago solicitada — sin respuesta", type: "reminder" },
      { date: "25 feb 2025", event: "Segundo recordatorio enviado — contacto AP señalado", type: "reminder" },
      { date: "28 feb 2025", event: "Factura venció — se recomienda escalación", type: "overdue" },
    ],
    notes: "Hacer seguimiento con T. Larsen del equipo AP de Vertex Capital. El cliente históricamente paga en 15 días — el retraso actual es inusual. Considerar escalación al responsable de cuenta S. Patel.",
    attachments: [
      { name: "Factura_INV-0044.pdf", size: "148 KB", generated: true },
      { name: "Delta_Infra_Fase1_SoW.pdf", size: "312 KB" },
    ],
  },
  "INV-0043": {
    id: "INV-0043",
    client: "Nexus Holdings",
    clientId: "c2",
    project: "Beta Relaunch",
    projectId: "p2",
    status: "Pendiente",
    issued: "25 feb 2025",
    due: "10 mar 2025",
    subtotal: "$29.630",
    tax: "$2.870",
    total: "$32.500",
    totalRaw: 32500,
    paidRaw: 0,
    paymentMethod: "Transferencia bancaria",
    observations: "Condiciones Net-14 estándar. Pago esperado antes del 10 de marzo.",
    lineItems: [
      { description: "Fase 2 — Hito de Rediseño y Prototipo", qty: 1, unitPrice: "$20.000", tax: "7%", total: "$20.000" },
      { description: "Estratega de Producto — 50 horas a $185/h", qty: 50, unitPrice: "$185", tax: "7%", total: "$9.250" },
      { description: "Informe de Investigación y Pruebas UX", qty: 1, unitPrice: "$3.250", tax: "7%", total: "$3.250" },
    ],
    payments: [],
    history: [
      { date: "25 feb 2025", event: "Factura emitida y entregada a finance@nexusholdings.com", type: "issued" },
    ],
    notes: "Sin acciones requeridas hasta el 8 de marzo.",
    attachments: [
      { name: "Factura_INV-0043.pdf", size: "122 KB", generated: true },
      { name: "BetaRelaunch_Hito2.pdf", size: "284 KB" },
    ],
  },
  "INV-0042": {
    id: "INV-0042",
    client: "Acme Corp",
    clientId: "c1",
    project: "Alpha Expansion",
    projectId: "p1",
    status: "Pagada",
    issued: "1 feb 2025",
    due: "15 feb 2025",
    subtotal: "$43.750",
    tax: "$4.250",
    total: "$48.000",
    totalRaw: 48000,
    paidRaw: 48000,
    paymentMethod: "Transferencia bancaria",
    observations: "Condiciones Net-14. Pago recibido dentro del plazo.",
    lineItems: [
      { description: "Fase 2 — Hito de Planificación de Infraestructura", qty: 1, unitPrice: "$28.000", tax: "7%", total: "$28.000" },
      { description: "Responsable de Proyecto — 80 horas a $195/h", qty: 80, unitPrice: "$195", tax: "7%", total: "$15.600" },
      { description: "Paquete de Documentación de Cumplimiento", qty: 1, unitPrice: "$4.400", tax: "7%", total: "$4.400" },
    ],
    payments: [
      { date: "12 feb 2025", method: "Transferencia bancaria", amount: "$48.000", reference: "REF-2025-0142", type: "paid" },
    ],
    history: [
      { date: "1 feb 2025", event: "Factura emitida y entregada", type: "issued" },
      { date: "12 feb 2025", event: "Pago recibido — $48.000 confirmados", amount: "$48.000", type: "paid" },
    ],
    notes: "Pagada en plazo. Archivo completo.",
    attachments: [
      { name: "Factura_INV-0042.pdf", size: "139 KB", generated: true },
      { name: "AlphaExpansion_Fase2_SoW.pdf", size: "298 KB" },
    ],
  },
  "INV-0046": {
    id: "INV-0046",
    client: "Acme Corp",
    clientId: "c1",
    project: "Alpha Expansion",
    projectId: "p1",
    status: "Pendiente",
    issued: "27 feb 2025",
    due: "20 mar 2025",
    subtotal: "$47.250",
    tax: "$4.750",
    total: "$52.000",
    totalRaw: 52000,
    paidRaw: 0,
    paymentMethod: "Transferencia bancaria",
    observations: "Condiciones Net-21. Fecha de vencimiento 20 de marzo.",
    lineItems: [
      { description: "Fase 3A — Inicio de Expansión Regional", qty: 1, unitPrice: "$30.000", tax: "7%", total: "$30.000" },
      { description: "Consultor Senior — 90 horas a $190/h", qty: 90, unitPrice: "$190", tax: "7%", total: "$17.100" },
      { description: "Viajes y costes de sede — Región Noreste", qty: 1, unitPrice: "$4.900", tax: "0%", total: "$4.900" },
    ],
    payments: [],
    history: [
      { date: "27 feb 2025", event: "Factura emitida y entregada a Cuentas a Pagar", type: "issued" },
    ],
    notes: "Sin acciones requeridas en este momento.",
    attachments: [
      { name: "Factura_INV-0046.pdf", size: "131 KB", generated: true },
      { name: "AlphaExpansion_Fase3A.pdf", size: "267 KB" },
    ],
  },
  "INV-0045": {
    id: "INV-0045",
    client: "Blue Arc Group",
    clientId: "c4",
    project: "Omega Platform",
    projectId: "p4",
    status: "Pagada",
    issued: "18 feb 2025",
    due: "1 mar 2025",
    subtotal: "$19.250",
    tax: "$1.750",
    total: "$21.000",
    totalRaw: 21000,
    paidRaw: 21000,
    paymentMethod: "Tarjeta de crédito corporativa",
    observations: "Pago anticipado. Sin condiciones especiales.",
    lineItems: [
      { description: "Fase 4 — Desarrollo del Módulo de Reportes", qty: 1, unitPrice: "$14.000", tax: "7%", total: "$14.000" },
      { description: "Ingeniero QA — 40 horas a $130/h", qty: 40, unitPrice: "$130", tax: "7%", total: "$5.200" },
    ],
    payments: [
      { date: "26 feb 2025", method: "Tarjeta de crédito corporativa", amount: "$21.000", reference: "REF-2025-0138", type: "paid" },
    ],
    history: [
      { date: "18 feb 2025", event: "Factura emitida", type: "issued" },
      { date: "26 feb 2025", event: "Pago recibido — $21.000 confirmados", amount: "$21.000", type: "paid" },
    ],
    notes: "Pagada con anticipación. Sin acciones pendientes.",
    attachments: [
      { name: "Factura_INV-0045.pdf", size: "118 KB", generated: true },
      { name: "Omega_Fase4_SoW.pdf", size: "241 KB" },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  Pagada:    { bg: "bg-[#DCFCE7]", text: "text-[#166534]", icon: CheckCircle2, label: "Pagada" },
  Pendiente: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]",  icon: Clock,        label: "Pendiente" },
  Vencida:   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]",  icon: AlertTriangle, label: "Vencida" },
  Borrador:  { bg: "bg-[#F1F5F9]", text: "text-[#64748B]",  icon: FileText,     label: "Borrador" },
};

const HISTORY_CONFIG: Record<PaymentEvent["type"], { bg: string; text: string; dot: string; label: string }> = {
  issued:   { bg: "bg-[#EFF6FF]",  text: "text-[#1D4ED8]",  dot: "bg-[#3B82F6]", label: "Emitida" },
  reminder: { bg: "bg-[#FEF9C3]",  text: "text-[#854D0E]",  dot: "bg-[#EAB308]", label: "Recordatorio" },
  paid:     { bg: "bg-[#DCFCE7]",  text: "text-[#166534]",  dot: "bg-[#22C55E]", label: "Pagada" },
  overdue:  { bg: "bg-[#FEE2E2]",  text: "text-[#991B1B]",  dot: "bg-[#EF4444]", label: "Vencida" },
  draft:    { bg: "bg-[#F1F5F9]",  text: "text-[#64748B]",  dot: "bg-[#94A3B8]", label: "Borrador" },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

// ── TAB: Resumen ──────────────────────────────────────────────────────────────

function TabResumen({ invoice }: { invoice: InvoiceData }) {
  const paidPercent = invoice.totalRaw > 0
    ? Math.round((invoice.paidRaw / invoice.totalRaw) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Overdue alert */}
      {invoice.status === "Vencida" && (
        <div className="flex items-start gap-3 bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-4">
          <AlertTriangle size={15} className="text-[#DC2626] mt-0.5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold text-[#991B1B]">Pago vencido — Acción inmediata requerida</p>
            <p className="text-xs text-[#991B1B] mt-0.5">
              Esta factura venció el {invoice.due}. Contacta al equipo de cuentas a pagar de{" "}
              {invoice.client}. Escala al responsable de cuenta si no hay respuesta en 48 horas.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main amounts card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-5">
          <SectionLabel>Desglose del importe</SectionLabel>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#EFF6FF] rounded-xl p-4">
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">{invoice.subtotal}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Subtotal</p>
            </div>
            <div className="bg-[#EFF6FF] rounded-xl p-4">
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">{invoice.tax}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Impuestos</p>
            </div>
            <div className="bg-[#DBEAFE] rounded-xl p-4">
              <p className="text-xl font-bold text-[#1D4ED8] tracking-tight">{invoice.total}</p>
              <p className="text-[10px] text-[#1D4ED8] mt-0.5">Total</p>
            </div>
          </div>

          {/* Payment progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#64748B]">Estado de cobro</span>
              <span className="text-xs font-semibold text-[#0F172A]">{paidPercent}% cobrado</span>
            </div>
            <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  paidPercent === 100 ? "bg-[#22C55E]" : paidPercent > 0 ? "bg-[#3B82F6]" : "bg-[#E2E8F0]"
                )}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
              <span>Pendiente: {invoice.paidRaw > 0 ? `$${(invoice.totalRaw - invoice.paidRaw).toLocaleString()}` : invoice.total}</span>
              {invoice.paidRaw > 0 && <span className="text-[#22C55E] font-medium">Pagado: {invoice.paidRaw.toLocaleString()}</span>}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
            <span className="text-xs text-[#64748B]">Estado</span>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
              STATUS_CONFIG[invoice.status].bg,
              STATUS_CONFIG[invoice.status].text
            )}>
              {invoice.status}
            </span>
          </div>
        </div>

        {/* Secondary info card */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
          <div>
            <SectionLabel>Cliente</SectionLabel>
            <Link
              href={`/clientes/${invoice.clientId}`}
              className="flex items-center gap-1.5 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
            >
              <Building2 size={13} strokeWidth={1.75} />
              {invoice.client}
              <ArrowUpRight size={11} />
            </Link>
          </div>

          <div>
            <SectionLabel>Proyecto</SectionLabel>
            <Link
              href={`/proyectos/${invoice.projectId}`}
              className="flex items-center gap-1.5 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
            >
              <Hash size={13} strokeWidth={1.75} />
              {invoice.project}
              <ArrowUpRight size={11} />
            </Link>
          </div>

          <div className="space-y-2 pt-1 border-t border-[#F1F5F9]">
            {[
              { label: "Fecha de emisión", value: invoice.issued, icon: Calendar },
              { label: "Fecha de vencimiento", value: invoice.due, icon: Calendar },
              { label: "Método de pago", value: invoice.paymentMethod, icon: CreditCard },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[#94A3B8] shrink-0">
                  <Icon size={11} strokeWidth={1.75} />
                  {label}
                </span>
                <span className="text-xs font-medium text-[#334155] text-right">{value}</span>
              </div>
            ))}
          </div>

          {invoice.observations && (
            <div className="pt-1 border-t border-[#F1F5F9]">
              <SectionLabel>Observaciones</SectionLabel>
              <p className="text-xs text-[#64748B] leading-relaxed">{invoice.observations}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TAB: Líneas ───────────────────────────────────────────────────────────────

function TabLineas({ invoice }: { invoice: InvoiceData }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Líneas de factura</SectionLabel>

      {/* Desktop table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <span className="col-span-5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Concepto</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Cantidad</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">P. unitario</span>
          <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">IVA</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Total</span>
        </div>

        {invoice.lineItems.map((item, i) => (
          <div
            key={i}
            className={cn(i < invoice.lineItems.length - 1 && "border-b border-[#F1F5F9]")}
          >
            {/* Desktop row */}
            <div className="hidden md:grid grid-cols-12 items-center px-5 py-4">
              <span className="col-span-5 text-sm text-[#334155] pr-4 leading-snug">{item.description}</span>
              <span className="col-span-2 text-sm text-[#64748B] text-right">{item.qty}</span>
              <span className="col-span-2 text-sm text-[#64748B] text-right">{item.unitPrice}</span>
              <span className="col-span-1 text-xs text-[#94A3B8] text-right">{item.tax}</span>
              <span className="col-span-2 text-sm font-semibold text-[#0F172A] text-right">{item.total}</span>
            </div>

            {/* Mobile card */}
            <div className="md:hidden px-4 py-4 space-y-2">
              <p className="text-sm text-[#334155] leading-snug">{item.description}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#94A3B8]">{item.qty} × {item.unitPrice}</span>
                  <span className="text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                    IVA {item.tax}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{item.total}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Totals footer */}
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">Subtotal</span>
            <span className="text-sm text-[#334155]">{invoice.subtotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">Impuestos</span>
            <span className="text-sm text-[#334155]">{invoice.tax}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
            <span className="text-sm font-semibold text-[#0F172A]">Total a pagar</span>
            <span className="text-base font-bold text-[#0F172A]">{invoice.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Pagos ────────────────────────────────────────────────────────────────

function TabPagos({ invoice }: { invoice: InvoiceData }) {
  const paidPercent = invoice.totalRaw > 0
    ? Math.round((invoice.paidRaw / invoice.totalRaw) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <SectionLabel>Pagos registrados</SectionLabel>

        {invoice.payments.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-10 text-center">
            <CreditCard size={28} className="text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#334155]">Sin pagos registrados</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              {invoice.status === "Vencida"
                ? "Esta factura está vencida. Registra el pago cuando se reciba."
                : "El pago aparecerá aquí cuando se confirme la recepción."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Fecha</span>
              <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Método</span>
              <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Referencia</span>
              <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Importe</span>
            </div>

            {invoice.payments.map((p, i) => (
              <div key={i} className={cn(i < invoice.payments.length - 1 && "border-b border-[#F1F5F9]")}>
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-12 items-center px-5 py-4">
                  <span className="col-span-3 text-sm text-[#334155]">{p.date}</span>
                  <span className="col-span-3 text-sm text-[#64748B]">{p.method}</span>
                  <span className="col-span-3 text-xs font-mono text-[#94A3B8]">{p.reference}</span>
                  <span className="col-span-3 text-sm font-semibold text-[#22C55E] text-right">{p.amount}</span>
                </div>
                {/* Mobile card */}
                <div className="sm:hidden px-4 py-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#0F172A]">{p.amount}</span>
                    <span className="text-xs text-[#64748B]">{p.date}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">{p.method}</p>
                  <p className="text-[10px] font-mono text-[#94A3B8]">{p.reference}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History timeline */}
        <div className="mt-2">
          <SectionLabel>Historial de actividad</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-2 divide-y divide-[#F1F5F9]">
            {invoice.history.map((event, i) => {
              const cfg = HISTORY_CONFIG[event.type];
              return (
                <div key={i} className="flex items-start gap-3 py-4">
                  <span className={cn("mt-1.5 shrink-0 w-2 h-2 rounded-full", cfg.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#334155] leading-snug">{event.event}</p>
                    {event.amount && (
                      <p className="text-xs font-semibold text-[#22C55E] mt-0.5">{event.amount} recibido</p>
                    )}
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{event.date}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded shrink-0",
                    cfg.bg, cfg.text
                  )}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar summary */}
      <div className="space-y-4">
        <SectionLabel>Resumen de cobro</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#EFF6FF] rounded-xl p-3.5">
              <p className="text-base font-bold text-[#0F172A]">{invoice.total}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Total emitido</p>
            </div>
            <div className={cn("rounded-xl p-3.5", invoice.paidRaw > 0 ? "bg-[#DCFCE7]" : "bg-[#F1F5F9]")}>
              <p className={cn("text-base font-bold", invoice.paidRaw > 0 ? "text-[#166534]" : "text-[#94A3B8]")}>
                {invoice.paidRaw > 0 ? `$${invoice.paidRaw.toLocaleString()}` : "$0"}
              </p>
              <p className="text-[10px] text-[#64748B] mt-0.5">Total cobrado</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={cn("h-full rounded-full", paidPercent === 100 ? "bg-[#22C55E]" : "bg-[#3B82F6]")}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-[#94A3B8]">{paidPercent}% cobrado</p>
          </div>

          <div className="pt-1 border-t border-[#F1F5F9] space-y-2">
            {[
              { label: "Fecha vencimiento", value: invoice.due },
              { label: "Método pactado", value: invoice.paymentMethod },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="text-xs text-[#94A3B8]">{label}</span>
                <span className="text-xs font-medium text-[#334155] text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Archivos ─────────────────────────────────────────────────────────────

function TabArchivos({ invoice }: { invoice: InvoiceData }) {
  return (
    <div className="max-w-2xl space-y-4">
      <SectionLabel>Archivos adjuntos</SectionLabel>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {invoice.attachments.map((file, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors",
              i < invoice.attachments.length - 1 && "border-b border-[#F1F5F9]"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
              file.generated ? "bg-[#DBEAFE]" : "bg-[#EFF6FF]"
            )}>
              <FileText size={15} className={file.generated ? "text-[#2563EB]" : "text-[#3B82F6]"} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#334155] truncate">{file.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[#94A3B8]">{file.size}</span>
                {file.generated && (
                  <span className="text-[10px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                    Generado por sistema
                  </span>
                )}
              </div>
            </div>
            <button className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-[#64748B] hover:text-[#3B82F6] hover:border-[#BFDBFE] transition-colors">
              <Download size={12} strokeWidth={1.75} />
              Descargar
            </button>
          </div>
        ))}
      </div>

      {/* Upload button */}
      <button className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border-2 border-dashed border-[#E2E8F0] text-sm text-[#94A3B8] hover:border-[#BFDBFE] hover:text-[#3B82F6] hover:bg-[#F8FAFC] transition-colors justify-center">
        <Upload size={14} strokeWidth={1.75} />
        Subir archivo adjunto
      </button>
    </div>
  );
}

// ── TAB: Notas ────────────────────────────────────────────────────────────────

function TabNotas({ invoice }: { invoice: InvoiceData }) {
  const [note, setNote] = useState(invoice.notes);

  return (
    <div className="max-w-2xl space-y-4">
      <SectionLabel>Notas internas</SectionLabel>
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <StickyNote size={14} className="text-[#94A3B8] mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Las notas internas son visibles únicamente para el equipo. No se incluyen en la factura enviada al cliente.
          </p>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#334155] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#BFDBFE] focus:border-[#3B82F6] resize-none transition-colors leading-relaxed"
          rows={6}
          placeholder="Agrega notas internas sobre esta factura..."
        />
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
            Guardar nota
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen",  label: "Resumen" },
  { key: "lineas",   label: "Líneas" },
  { key: "pagos",    label: "Pagos" },
  { key: "archivos", label: "Archivos" },
  { key: "notas",    label: "Notas" },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const invoice = INVOICE_DATA[id as string] ?? INVOICE_DATA["INV-0044"];
  const statusCfg = STATUS_CONFIG[invoice.status];
  const StatusIcon = statusCfg.icon;

  return (
    <ContextShell
      breadcrumbs={[
        { label: "Funds", href: "/" },
        { label: "Facturación", href: "/facturacion" },
        { label: invoice.id },
      ]}
      heading={
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
            Factura {invoice.id}
          </h1>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
            statusCfg.bg, statusCfg.text
          )}>
            <StatusIcon size={12} strokeWidth={2} />
            {statusCfg.label}
          </span>
        </div>
      }
      meta={
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            <Link href={`/clientes/${invoice.clientId}`} className="hover:text-[#3B82F6] transition-colors">
              {invoice.client}
            </Link>
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Hash size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            <Link href={`/proyectos/${invoice.projectId}`} className="hover:text-[#3B82F6] transition-colors">
              {invoice.project}
            </Link>
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Calendar size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            Emitida {invoice.issued}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Calendar size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            Vence {invoice.due}
          </span>
          <span className="text-sm font-bold text-[#0F172A]">{invoice.total}</span>
        </div>
      }
      actions={
        <>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
            <Download size={13} strokeWidth={1.75} />
            Descargar PDF
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
            <Send size={13} strokeWidth={1.75} />
            Enviar por correo
          </button>
          {(invoice.status === "Pendiente" || invoice.status === "Vencida") && (
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
              <CheckCircle2 size={13} strokeWidth={1.75} />
              Marcar como pagada
            </button>
          )}
        </>
      }
      tabs={TABS}
      defaultTab="resumen"
      copilotContext="Funds"
    >
      {(activeTab) => {
        if (activeTab === "resumen")  return <TabResumen invoice={invoice} />;
        if (activeTab === "lineas")   return <TabLineas invoice={invoice} />;
        if (activeTab === "pagos")    return <TabPagos invoice={invoice} />;
        if (activeTab === "archivos") return <TabArchivos invoice={invoice} />;
        if (activeTab === "notas")    return <TabNotas invoice={invoice} />;
        return null;
      }}
    </ContextShell>
  );
}
