"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"

const SKINA_BLUE = "#1a3a5c"
const SKINA_ACCENT = "#e8f0fe"
const SKINA_GRAY = "#6b7280"

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1f2937",
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 50,
  },
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
  logoText: { color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 3 },
  logoSub: { color: "#fff", fontSize: 7, letterSpacing: 2, marginTop: 2, opacity: 0.8 },
  title: { fontSize: 22, fontWeight: 700, color: SKINA_BLUE, letterSpacing: 1, textAlign: "right" },
  subtitle: { fontSize: 10, color: SKINA_GRAY, marginTop: 4, textAlign: "right" },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 25,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: SKINA_ACCENT,
    padding: 14,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: SKINA_BLUE,
  },
  kpiLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: { fontSize: 18, fontWeight: 700, color: "#111827" },
  kpiDelta: { fontSize: 8, color: SKINA_GRAY, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: SKINA_BLUE,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: SKINA_BLUE,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  thText: { color: "#fff", fontSize: 7, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  trAlt: { backgroundColor: "#f9fafb" },
  cell: { fontSize: 9, color: "#374151" },
  cellBold: { fontSize: 9, fontWeight: 700, color: "#111827" },
  col1: { flex: 3 },
  col2: { flex: 2, textAlign: "right" },
  col3: { flex: 2, textAlign: "right" },
  barContainer: { marginTop: 4, height: 6, backgroundColor: "#e5e7eb", borderRadius: 3 },
  barFill: { height: 6, backgroundColor: SKINA_BLUE, borderRadius: 3 },
  summaryBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: SKINA_ACCENT,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: SKINA_BLUE,
  },
  summaryTitle: { fontSize: 8, fontWeight: 700, color: SKINA_BLUE, letterSpacing: 1, marginBottom: 6 },
  summaryText: { fontSize: 9, lineHeight: 1.7, color: "#374151" },
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
  footerLeft: { fontSize: 7, color: SKINA_BLUE, fontWeight: 700, letterSpacing: 1 },
  footerRight: { fontSize: 7, color: SKINA_GRAY },
})

function fmt(n: number) {
  return `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface ReporteSkinaProps {
  titulo: string
  periodo: string
  fecha: string
  ingresos: number
  gastos: number
  beneficio: number
  facturasPagadas: number
  facturasPendientes: number
  facturasVencidas: number
  clientesActivos: number
  desglose: Array<{ concepto: string; monto: number; porcentaje: number }>
  resumen?: string
}

export function ReporteSkina({
  titulo,
  periodo,
  fecha,
  ingresos,
  gastos,
  beneficio,
  facturasPagadas,
  facturasPendientes,
  facturasVencidas,
  clientesActivos,
  desglose,
  resumen,
}: ReporteSkinaProps) {
  const margen = ingresos > 0 ? Math.round((beneficio / ingresos) * 100) : 0

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>SKINA</Text>
            <Text style={s.logoSub}>CREATIVE STUDIO</Text>
          </View>
          <View>
            <Text style={s.title}>{titulo}</Text>
            <Text style={s.subtitle}>{periodo} · {fecha}</Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Ingresos</Text>
            <Text style={s.kpiValue}>{fmt(ingresos)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Gastos</Text>
            <Text style={s.kpiValue}>{fmt(gastos)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Beneficio</Text>
            <Text style={s.kpiValue}>{fmt(beneficio)}</Text>
            <Text style={s.kpiDelta}>Margen: {margen}%</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Facturas pagadas</Text>
            <Text style={s.kpiValue}>{facturasPagadas}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Pendientes</Text>
            <Text style={s.kpiValue}>{facturasPendientes}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Vencidas</Text>
            <Text style={s.kpiValue}>{facturasVencidas}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Clientes activos</Text>
            <Text style={s.kpiValue}>{clientesActivos}</Text>
          </View>
        </View>

        {/* Breakdown */}
        {desglose.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Desglose por concepto</Text>
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.col1]}>Concepto</Text>
              <Text style={[s.thText, s.col2]}>Monto</Text>
              <Text style={[s.thText, s.col3]}>%</Text>
            </View>
            {desglose.map((item, i) => (
              <View key={i}>
                <View style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                  <Text style={[s.cell, s.col1]}>{item.concepto}</Text>
                  <Text style={[s.cellBold, s.col2]}>{fmt(item.monto)}</Text>
                  <Text style={[s.cell, s.col3]}>{item.porcentaje}%</Text>
                </View>
                <View style={[s.barContainer, { marginHorizontal: 10 }]}>
                  <View style={[s.barFill, { width: `${Math.min(item.porcentaje, 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        {resumen && (
          <View style={s.summaryBox}>
            <Text style={s.summaryTitle}>Resumen ejecutivo</Text>
            <Text style={s.summaryText}>{resumen}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>SKINA — www.skina.ch</Text>
          <Text style={s.footerRight}>{titulo} · {periodo}</Text>
        </View>
      </Page>
    </Document>
  )
}
