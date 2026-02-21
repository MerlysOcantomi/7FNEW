"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: 700 },
    { src: "Helvetica-Oblique", fontStyle: "italic" },
  ],
})

const SKINA_BLUE = "#1a3a5c"
const SKINA_LIGHT = "#2d6cb4"
const SKINA_ACCENT = "#e8f0fe"
const SKINA_GRAY = "#6b7280"
const SKINA_BORDER = "#d1d5db"

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1f2937",
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 50,
  },
  /* ── Header ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: SKINA_BLUE,
  },
  logoBox: {
    backgroundColor: SKINA_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  logoText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 3,
  },
  logoSub: {
    color: "#ffffff",
    fontSize: 7,
    letterSpacing: 2,
    marginTop: 2,
    opacity: 0.8,
  },
  invoiceLabel: {
    textAlign: "right",
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 11,
    color: SKINA_LIGHT,
    marginTop: 4,
  },
  /* ── Info blocks ── */
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
    gap: 30,
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  infoTitle: {
    fontSize: 7,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  infoLine: {
    fontSize: 9,
    lineHeight: 1.6,
    color: "#374151",
  },
  infoBold: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },
  /* ── Dates ── */
  datesRow: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 25,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: SKINA_ACCENT,
    borderRadius: 4,
  },
  dateItem: {},
  dateLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  dateValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111827",
  },
  /* ── Table ── */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: SKINA_BLUE,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 3,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 700,
    color: "#111827",
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 2, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  /* ── Totals ── */
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 15,
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  totalLabel: {
    fontSize: 9,
    color: SKINA_GRAY,
  },
  totalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: "#374151",
  },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: SKINA_BLUE,
    borderRadius: 3,
    marginTop: 4,
  },
  totalFinalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: 1,
  },
  totalFinalValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
  },
  /* ── Payment ── */
  paymentSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: SKINA_BORDER,
  },
  paymentTitle: {
    fontSize: 7,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  paymentGrid: {
    flexDirection: "row",
    gap: 20,
  },
  paymentCard: {
    flex: 1,
    backgroundColor: SKINA_ACCENT,
    padding: 12,
    borderRadius: 4,
  },
  paymentMethod: {
    fontSize: 8,
    fontWeight: 700,
    color: SKINA_BLUE,
    marginBottom: 4,
  },
  paymentDetail: {
    fontSize: 8,
    color: "#374151",
    lineHeight: 1.5,
  },
  /* ── Legal + Footer ── */
  legal: {
    marginTop: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: SKINA_BORDER,
  },
  legalText: {
    fontSize: 7,
    color: SKINA_GRAY,
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: SKINA_BLUE,
  },
  footerLeft: {
    fontSize: 7,
    color: SKINA_BLUE,
    fontWeight: 700,
    letterSpacing: 1,
  },
  footerRight: {
    fontSize: 7,
    color: SKINA_GRAY,
  },
})

function formatCurrency(value: number): string {
  return `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateSafe(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return value
  }
}

export interface FacturaSkinaProps {
  numero: string
  estado: string
  fechaEmision: string | null
  fechaVencimiento: string | null
  subtotal: number
  impuesto: number
  total: number
  items: Array<{
    descripcion?: string
    concepto?: string
    cantidad?: number
    precioUnitario?: number
    precio?: number
    total?: number
  }>
  cliente?: {
    nombre?: string
    email?: string
    telefono?: string
    empresa?: string
  } | null
  proyecto?: {
    nombre?: string
  } | null
  emisor?: {
    nombre: string
    direccion: string
    ciudad: string
    pais: string
    email: string
    telefono: string
    web: string
  }
}

const DEFAULT_EMISOR = {
  nombre: "Skina Creative Studio",
  direccion: "Bahnhofstrasse 42",
  ciudad: "8001 Zurich",
  pais: "Suiza",
  email: "hello@skina.ch",
  telefono: "+41 44 000 00 00",
  web: "www.skina.ch",
}

export function FacturaSkina({
  numero,
  estado,
  fechaEmision,
  fechaVencimiento,
  subtotal,
  impuesto,
  total,
  items,
  cliente,
  proyecto,
  emisor = DEFAULT_EMISOR,
}: FacturaSkinaProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <View style={s.logoBox}>
              <Text style={s.logoText}>SKINA</Text>
              <Text style={s.logoSub}>CREATIVE STUDIO</Text>
            </View>
          </View>
          <View style={s.invoiceLabel}>
            <Text style={s.invoiceTitle}>FACTURA</Text>
            <Text style={s.invoiceNumber}>N.° {numero}</Text>
          </View>
        </View>

        {/* ── Emisor + Cliente ── */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoTitle}>Emisor</Text>
            <Text style={s.infoBold}>{emisor.nombre}</Text>
            <Text style={s.infoLine}>{emisor.direccion}</Text>
            <Text style={s.infoLine}>{emisor.ciudad}, {emisor.pais}</Text>
            <Text style={s.infoLine}>{emisor.email}</Text>
            <Text style={s.infoLine}>{emisor.telefono}</Text>
          </View>
          <View style={s.infoBlockRight}>
            <Text style={s.infoTitle}>Cliente</Text>
            <Text style={s.infoBold}>{cliente?.nombre || "—"}</Text>
            {cliente?.empresa && <Text style={s.infoLine}>{cliente.empresa}</Text>}
            {cliente?.email && <Text style={s.infoLine}>{cliente.email}</Text>}
            {cliente?.telefono && <Text style={s.infoLine}>{cliente.telefono}</Text>}
          </View>
        </View>

        {/* ── Dates ── */}
        <View style={s.datesRow}>
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Fecha de emision</Text>
            <Text style={s.dateValue}>{formatDateSafe(fechaEmision)}</Text>
          </View>
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Fecha de vencimiento</Text>
            <Text style={s.dateValue}>{formatDateSafe(fechaVencimiento)}</Text>
          </View>
          <View style={s.dateItem}>
            <Text style={s.dateLabel}>Estado</Text>
            <Text style={s.dateValue}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</Text>
          </View>
          {proyecto?.nombre && (
            <View style={s.dateItem}>
              <Text style={s.dateLabel}>Proyecto</Text>
              <Text style={s.dateValue}>{proyecto.nombre}</Text>
            </View>
          )}
        </View>

        {/* ── Table Header ── */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, s.colDesc]}>Descripcion</Text>
          <Text style={[s.tableHeaderText, s.colQty]}>Cant.</Text>
          <Text style={[s.tableHeaderText, s.colPrice]}>Precio unit.</Text>
          <Text style={[s.tableHeaderText, s.colTotal]}>Total</Text>
        </View>

        {/* ── Table Rows ── */}
        {items.map((item, i) => {
          const qty = item.cantidad ?? 1
          const price = item.precioUnitario ?? item.precio ?? 0
          const lineTotal = item.total ?? qty * price
          return (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tableCell, s.colDesc]}>
                {item.descripcion ?? item.concepto ?? `Servicio ${i + 1}`}
              </Text>
              <Text style={[s.tableCell, s.colQty]}>{qty}</Text>
              <Text style={[s.tableCell, s.colPrice]}>{formatCurrency(price)}</Text>
              <Text style={[s.tableCellBold, s.colTotal]}>{formatCurrency(lineTotal)}</Text>
            </View>
          )
        })}

        {items.length === 0 && (
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 1, textAlign: "center", color: SKINA_GRAY }]}>
              Sin conceptos registrados
            </Text>
          </View>
        )}

        {/* ── Totals ── */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>IVA / Impuesto</Text>
              <Text style={s.totalValue}>{formatCurrency(impuesto)}</Text>
            </View>
            <View style={s.totalFinalRow}>
              <Text style={s.totalFinalLabel}>TOTAL</Text>
              <Text style={s.totalFinalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Payment Methods ── */}
        <View style={s.paymentSection}>
          <Text style={s.paymentTitle}>Metodos de pago</Text>
          <View style={s.paymentGrid}>
            <View style={s.paymentCard}>
              <Text style={s.paymentMethod}>Transferencia bancaria</Text>
              <Text style={s.paymentDetail}>Banco: UBS Switzerland AG</Text>
              <Text style={s.paymentDetail}>IBAN: CH00 0000 0000 0000 0000 0</Text>
              <Text style={s.paymentDetail}>BIC/SWIFT: UBSWCHZH80A</Text>
              <Text style={s.paymentDetail}>Referencia: {numero}</Text>
            </View>
            <View style={s.paymentCard}>
              <Text style={s.paymentMethod}>Pago digital</Text>
              <Text style={s.paymentDetail}>PayPal: {emisor.email}</Text>
              <Text style={s.paymentDetail}>TWINT: {emisor.telefono}</Text>
              <Text style={s.paymentDetail}>Indicar referencia: {numero}</Text>
            </View>
          </View>
        </View>

        {/* ── Legal ── */}
        <View style={s.legal}>
          <Text style={s.legalText}>
            Condiciones de pago: Pago neto a 30 dias desde la fecha de emision. En caso de retraso se aplicara un interes
            de demora del 5% anual conforme al articulo 104 del Codigo de Obligaciones suizo (OR). Esta factura se
            considera aceptada si no se presenta objecion por escrito dentro de los 10 dias siguientes a su recepcion.
            Todos los precios estan en francos suizos (CHF). Fuero juridico: Zurich, Suiza.
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>SKINA — {emisor.web}</Text>
          <Text style={s.footerRight}>Factura {numero} · Pagina 1</Text>
        </View>
      </Page>
    </Document>
  )
}
