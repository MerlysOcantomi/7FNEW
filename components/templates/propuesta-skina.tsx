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
  title: { fontSize: 24, fontWeight: 700, color: SKINA_BLUE, letterSpacing: 1, textAlign: "right" },
  subtitle: { fontSize: 10, color: "#6b7280", marginTop: 4, textAlign: "right" },
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
  paragraph: { fontSize: 9, lineHeight: 1.7, color: "#374151" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25, gap: 30 },
  infoBlock: { flex: 1 },
  infoTitle: { fontSize: 7, fontWeight: 700, color: SKINA_BLUE, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  infoLine: { fontSize: 9, lineHeight: 1.6, color: "#374151" },
  infoBold: { fontSize: 10, fontWeight: 700, color: "#111827" },
  servicesHeader: {
    flexDirection: "row",
    backgroundColor: SKINA_BLUE,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 3,
  },
  servicesHeaderText: { color: "#fff", fontSize: 7, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  serviceRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  serviceRowAlt: { backgroundColor: "#f9fafb" },
  colName: { flex: 4 },
  colPrice: { flex: 2, textAlign: "right" },
  cell: { fontSize: 9, color: "#374151" },
  cellBold: { fontSize: 9, fontWeight: 700, color: "#111827" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: SKINA_BLUE,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 3,
    marginTop: 8,
  },
  totalLabel: { fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1 },
  totalValue: { fontSize: 14, fontWeight: 700, color: "#fff" },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SKINA_BLUE,
    marginTop: 3,
  },
  conditions: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
  },
  conditionsText: { fontSize: 7, color: SKINA_GRAY, lineHeight: 1.6 },
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
  footerText: { fontSize: 7, color: SKINA_BLUE, fontWeight: 700, letterSpacing: 1 },
  footerRight: { fontSize: 7, color: SKINA_GRAY },
})

function fmt(n: number) {
  return `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface PropuestaSkinaProps {
  titulo: string
  fecha: string
  cliente: { nombre: string; empresa?: string; email?: string }
  descripcion: string
  servicios: Array<{ nombre: string; precio: number }>
  timeline?: Array<{ fase: string; duracion: string }>
  total: number
  condiciones?: string
}

export function PropuestaSkina({
  titulo,
  fecha,
  cliente,
  descripcion,
  servicios,
  timeline,
  total,
  condiciones,
}: PropuestaSkinaProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>SKINA</Text>
            <Text style={s.logoSub}>CREATIVE STUDIO</Text>
          </View>
          <View>
            <Text style={s.title}>PROPUESTA</Text>
            <Text style={s.subtitle}>{fecha}</Text>
          </View>
        </View>

        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoTitle}>Preparado para</Text>
            <Text style={s.infoBold}>{cliente.nombre}</Text>
            {cliente.empresa && <Text style={s.infoLine}>{cliente.empresa}</Text>}
            {cliente.email && <Text style={s.infoLine}>{cliente.email}</Text>}
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoTitle}>Proyecto</Text>
            <Text style={s.infoBold}>{titulo}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Descripcion del proyecto</Text>
          <Text style={s.paragraph}>{descripcion}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Servicios incluidos</Text>
          <View style={s.servicesHeader}>
            <Text style={[s.servicesHeaderText, s.colName]}>Servicio</Text>
            <Text style={[s.servicesHeaderText, s.colPrice]}>Precio</Text>
          </View>
          {servicios.map((srv, i) => (
            <View key={i} style={[s.serviceRow, i % 2 === 1 ? s.serviceRowAlt : {}]}>
              <Text style={[s.cell, s.colName]}>{srv.nombre}</Text>
              <Text style={[s.cellBold, s.colPrice]}>{fmt(srv.precio)}</Text>
            </View>
          ))}
          <View style={s.totalBar}>
            <Text style={s.totalLabel}>TOTAL</Text>
            <Text style={s.totalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {timeline && timeline.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cronograma estimado</Text>
            {timeline.map((item, i) => (
              <View key={i} style={s.timelineItem}>
                <View style={s.timelineDot} />
                <View>
                  <Text style={s.cellBold}>{item.fase}</Text>
                  <Text style={s.cell}>{item.duracion}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.conditions}>
          <Text style={s.conditionsText}>
            {condiciones ??
              "Esta propuesta tiene una validez de 30 dias desde su fecha de emision. Los precios indicados no incluyen IVA. El inicio del proyecto esta sujeto a la aceptacion por escrito de esta propuesta y al pago del anticipo correspondiente (50%). El plazo de entrega comienza a partir de la recepcion del material necesario por parte del cliente. Fuero juridico: Zurich, Suiza."}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>SKINA — www.skina.ch</Text>
          <Text style={s.footerRight}>Propuesta: {titulo}</Text>
        </View>
      </Page>
    </Document>
  )
}
