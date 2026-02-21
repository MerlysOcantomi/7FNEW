export interface CSVColumn {
  key: string
  label: string
  format?: (value: unknown, row: Record<string, unknown>) => string
}

export function generateCSV(
  data: Record<string, unknown>[],
  columns: CSVColumn[],
): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(",")

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = getNestedValue(row, col.key)
        const formatted = col.format ? col.format(raw, row) : String(raw ?? "")
        return escapeCSV(formatted)
      })
      .join(","),
  )

  return [header, ...rows].join("\n")
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function downloadCSV(csv: string, filename: string): void {
  const BOM = "\uFEFF"
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatDate(value: unknown): string {
  if (!value) return ""
  try {
    const d = new Date(value as string)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return String(value)
  }
}

export function formatCurrency(value: unknown): string {
  const num = Number(value)
  if (isNaN(num)) return ""
  return `$${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Pre-built column sets ── */

export const FACTURA_COLUMNS: CSVColumn[] = [
  { key: "numero", label: "Numero" },
  { key: "estado", label: "Estado" },
  { key: "cliente.nombre", label: "Cliente" },
  { key: "proyecto.nombre", label: "Proyecto" },
  { key: "subtotal", label: "Subtotal", format: formatCurrency },
  { key: "impuesto", label: "Impuesto", format: formatCurrency },
  { key: "total", label: "Total", format: formatCurrency },
  { key: "fechaEmision", label: "Emision", format: formatDate },
  { key: "fechaVencimiento", label: "Vencimiento", format: formatDate },
]

export const CLIENTE_COLUMNS: CSVColumn[] = [
  { key: "nombre", label: "Nombre" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Telefono" },
  { key: "empresa", label: "Empresa" },
  { key: "tipo", label: "Tipo" },
  { key: "estado", label: "Estado" },
  { key: "createdAt", label: "Creado", format: formatDate },
]

export const PROYECTO_COLUMNS: CSVColumn[] = [
  { key: "nombre", label: "Nombre" },
  { key: "estado", label: "Estado" },
  { key: "prioridad", label: "Prioridad" },
  { key: "progreso", label: "Progreso (%)" },
  { key: "cliente.nombre", label: "Cliente" },
  { key: "presupuesto", label: "Presupuesto", format: formatCurrency },
  { key: "fechaInicio", label: "Inicio", format: formatDate },
  { key: "fechaFin", label: "Fin", format: formatDate },
]

export const TAREA_COLUMNS: CSVColumn[] = [
  { key: "titulo", label: "Titulo" },
  { key: "estado", label: "Estado" },
  { key: "prioridad", label: "Prioridad" },
  { key: "proyecto.nombre", label: "Proyecto" },
  { key: "cliente.nombre", label: "Cliente" },
  { key: "fechaLimite", label: "Fecha limite", format: formatDate },
  { key: "createdAt", label: "Creado", format: formatDate },
]

export const TRANSACCION_COLUMNS: CSVColumn[] = [
  { key: "tipo", label: "Tipo" },
  { key: "monto", label: "Monto", format: formatCurrency },
  { key: "descripcion", label: "Descripcion" },
  { key: "categoria", label: "Categoria" },
  { key: "cliente.nombre", label: "Cliente" },
  { key: "proyecto.nombre", label: "Proyecto" },
  { key: "fecha", label: "Fecha", format: formatDate },
]
