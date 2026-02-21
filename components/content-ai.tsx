"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  Lightbulb,
  Type,
  FileText,
  Calendar,
  Search,
  Wand2,
  Send,
  Bot,
  User,
} from "lucide-react"

const aiActions = [
  { id: "ideas", label: "Generar ideas", description: "Propone ideas creativas basadas en el contexto del proyecto", icon: Lightbulb, color: "var(--tab-ai)" },
  { id: "mejorar", label: "Mejorar texto", description: "Refina y mejora la calidad de un copy o texto editorial", icon: Type, color: "var(--tab-info)" },
  { id: "resumir", label: "Resumir contenido", description: "Genera un resumen conciso de documentos o piezas extensas", icon: FileText, color: "var(--tab-phases)" },
  { id: "calendario", label: "Proponer calendario", description: "Sugiere una planificacion editorial basada en los proyectos activos", icon: Calendar, color: "var(--tab-tasks)" },
  { id: "analizar", label: "Analizar pieza", description: "Evalua una pieza creativa y sugiere mejoras", icon: Search, color: "var(--tab-docs)" },
  { id: "sugerir", label: "Sugerir mejoras", description: "Propone optimizaciones para contenido existente", icon: Wand2, color: "var(--tab-review)" },
]

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

const mockMessages: Message[] = [
  {
    id: "m1",
    role: "user",
    content: "Necesito ideas para una campana visual minimalista para Alpha Corp. El tema es su rebranding con enfoque editorial.",
    timestamp: "10:42",
  },
  {
    id: "m2",
    role: "assistant",
    content: "Aqui van 3 propuestas para la campana visual de Alpha Corp:\n\n1. Serie \"Detras del cambio\" -- Documentar el proceso de rebranding en 5 piezas en blanco y negro con acentos del nuevo color primario.\n\n2. Contrastes -- Antes y despues lado a lado en formato split-screen. Tipografia serif grande con el tagline del rebranding.\n\n3. Texturas y marca -- Mockups del nuevo logo sobre superficies organicas (madera, papel kraft, concreto) con iluminacion natural suave.\n\nTodas siguen la estetica editorial y minimalista de 7F. Puedo desarrollar cualquiera en detalle.",
    timestamp: "10:42",
  },
  {
    id: "m3",
    role: "user",
    content: "La opcion 1 me gusta. Puedes proponer un calendario de publicacion para las 5 piezas?",
    timestamp: "10:45",
  },
  {
    id: "m4",
    role: "assistant",
    content: "Calendario propuesto para \"Detras del cambio\" -- Alpha Corp:\n\nPieza 1 (3 mar) - El brief: Como nacio la necesidad del cambio\nPieza 2 (6 mar) - Exploracion: Moodboards y direcciones iniciales\nPieza 3 (10 mar) - Iteracion: El camino hacia la marca final\nPieza 4 (13 mar) - Resultado: La nueva identidad en detalle\nPieza 5 (17 mar) - En accion: La marca viva en todas sus aplicaciones\n\nFrecuencia: 2 publicaciones por semana (lunes y jueves). Formato recomendado: carrusel para redes + articulo largo en blog.",
    timestamp: "10:46",
  },
]

export function ContentAI() {
  const [messages] = useState<Message[]>(mockMessages)
  const [input, setInput] = useState("")
  const [activeAction, setActiveAction] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">IA Editorial</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Asistente creativo para generar, mejorar y planificar contenido</p>
      </div>

      {/* Actions grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {aiActions.map(action => {
          const Icon = action.icon
          const isActive = activeAction === action.id
          return (
            <button
              key={action.id}
              onClick={() => setActiveAction(isActive ? null : action.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                isActive
                  ? "border-foreground/20 bg-card shadow-sm"
                  : "border-border bg-card hover:bg-muted/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: action.color }}>
                  <Icon className="h-4 w-4 text-foreground/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Conversation */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Conversacion editorial</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{messages.length} mensajes</span>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-5 flex flex-col gap-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tab-ai)] flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-foreground/60" />
                </div>
              )}
              <div className={cn(
                "rounded-xl px-4 py-3 max-w-[85%]",
                msg.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-muted/50 border border-border text-foreground"
              )}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                <p className={cn("text-[10px] mt-1.5", msg.role === "user" ? "text-background/60" : "text-muted-foreground")}>{msg.timestamp}</p>
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={activeAction
                  ? `Escribe instrucciones para: ${aiActions.find(a => a.id === activeAction)?.label}...`
                  : "Escribe una consulta editorial..."}
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80 flex-shrink-0"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {activeAction && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Accion activa:</span>
              <span className="rounded-full bg-[var(--tab-ai)] px-2.5 py-0.5 text-[10px] font-medium text-foreground/70">
                {aiActions.find(a => a.id === activeAction)?.label}
              </span>
              <button onClick={() => setActiveAction(null)} className="text-[11px] text-muted-foreground hover:text-foreground ml-1">Cancelar</button>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ideas generadas</p>
          <p className="text-xl font-semibold text-foreground mt-1">24</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">este mes</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Textos mejorados</p>
          <p className="text-xl font-semibold text-foreground mt-1">18</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">este mes</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Calendarios sugeridos</p>
          <p className="text-xl font-semibold text-foreground mt-1">6</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">este mes</p>
        </div>
      </div>
    </div>
  )
}
