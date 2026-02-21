"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Search,
  Send,
  Plus,
  User,
  Users,
  Clock,
  Paperclip,
  ChevronRight,
  X,
  Hash,
  AtSign,
} from "lucide-react"

/* ── Data ── */
const channels = [
  { id: "general", name: "General", type: "canal", unread: 2, lastMessage: "Recuerden la reunion de manana a las 10am", lastAuthor: "Carlos M.", lastTime: "Hace 1h" },
  { id: "diseno", name: "Diseno", type: "canal", unread: 0, lastMessage: "Subi las variantes del logotipo al drive", lastAuthor: "Ana R.", lastTime: "Hace 3h" },
  { id: "desarrollo", name: "Desarrollo", type: "canal", unread: 1, lastMessage: "El deploy de staging quedo listo", lastAuthor: "Miguel T.", lastTime: "Hace 2h" },
  { id: "marketing", name: "Marketing", type: "canal", unread: 0, lastMessage: "Contenido de la semana programado", lastAuthor: "Isabela C.", lastTime: "Hace 5h" },
]

const directMessages = [
  { id: "dm-1", name: "Ana Rodriguez", type: "directo", unread: 1, lastMessage: "Puedes revisar los mockups que subi?", lastTime: "Hace 30min", avatar: "AR" },
  { id: "dm-2", name: "Carlos Mendez", type: "directo", unread: 0, lastMessage: "Perfecto, agendo la reunion", lastTime: "Hace 2h", avatar: "CM" },
  { id: "dm-3", name: "Laura Chen", type: "directo", unread: 0, lastMessage: "El presupuesto ya esta aprobado", lastTime: "Hace 4h", avatar: "LC" },
  { id: "dm-4", name: "Sofia Torres", type: "directo", unread: 0, lastMessage: "Mande el brief por email", lastTime: "Hace 1d", avatar: "ST" },
  { id: "dm-5", name: "Roberto Diaz", type: "directo", unread: 0, lastMessage: "Listo el API endpoint", lastTime: "Hace 1d", avatar: "RD" },
]

const clientThreads = [
  { id: "ct-1", name: "Alpha Corp - Revision propuesta", type: "cliente", unread: 2, lastMessage: "Hola, revise la propuesta y tengo algunos comentarios sobre la seccion de costos...", lastAuthor: "Maria Lopez (Alpha)", lastTime: "Hace 1h" },
  { id: "ct-2", name: "Beta Labs - Aprobacion fase", type: "cliente", unread: 0, lastMessage: "El cliente aprobo la fase de descubrimiento. Podemos avanzar.", lastAuthor: "Roberto D.", lastTime: "Hace 3h" },
  { id: "ct-3", name: "Gamma Inc - Entrega final", type: "cliente", unread: 0, lastMessage: "La presentacion final esta lista. Adjunto el enlace para revision.", lastAuthor: "Sofia T.", lastTime: "Hace 5h" },
  { id: "ct-4", name: "Delta Tech - Kickoff", type: "cliente", unread: 0, lastMessage: "Confirmamos la fecha de inicio para el 1 de marzo.", lastAuthor: "Valentina M.", lastTime: "Hace 1d" },
]

const sampleMessages = [
  { id: "m1", author: "Carlos Mendez", avatar: "CM", text: "Buenos dias equipo. Recuerden que manana tenemos la reunion de revision mensual a las 10am.", time: "09:15", isOwn: false },
  { id: "m2", author: "Ana Rodriguez", avatar: "AR", text: "Confirmo asistencia. Voy a preparar la presentacion de avances de diseno.", time: "09:22", isOwn: false },
  { id: "m3", author: "Tu", avatar: "AD", text: "Perfecto. Yo preparo el resumen financiero y el status de proyectos.", time: "09:30", isOwn: true },
  { id: "m4", author: "Laura Chen", avatar: "LC", text: "Puedo compartir pantalla para el timeline de entregas si les parece", time: "09:35", isOwn: false },
  { id: "m5", author: "Carlos Mendez", avatar: "CM", text: "Excelente, suena bien. Nos vemos manana entonces.", time: "09:40", isOwn: false },
]

type ViewType = "canales" | "directos" | "clientes"

export default function ComunicacionPage() {
  const [view, setView] = useState<ViewType>("canales")
  const [search, setSearch] = useState("")
  const [selectedThread, setSelectedThread] = useState<string | null>("general")

  const currentItems = view === "canales" ? channels : view === "directos" ? directMessages : clientThreads
  const filtered = currentItems.filter(item => search === "" || item.name.toLowerCase().includes(search.toLowerCase()))

  const totalUnread = [...channels, ...directMessages, ...clientThreads].reduce((a, c) => a + c.unread, 0)

  return (
    <AppShell currentSection="comunicacion" breadcrumbs={[{ label: "7F" }, { label: "Comunicacion" }]}>
      <SectionPage title="Comunicacion" description="Mensajes internos del equipo, hilos con clientes y canales por area.">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Canales</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{channels.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mensajes directos</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{directMessages.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hilos con clientes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{clientThreads.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">No leidos</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totalUnread}</p>
          </div>
        </div>

        {/* View tabs + search */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {(["canales", "directos", "clientes"] as ViewType[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedThread(null) }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors capitalize",
                  view === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
            <button className="ml-auto flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80">
              <Plus className="h-3.5 w-3.5" /> Nuevo
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar conversacion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Thread list + chat view */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Thread list */}
          <div className={cn("flex flex-col gap-1.5", selectedThread ? "lg:col-span-2" : "lg:col-span-5")}>
            {filtered.map(item => {
              const isSelected = selectedThread === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedThread(item.id)}
                  className={cn(
                    "w-full rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-sm",
                    isSelected ? "border-foreground/30 shadow-sm" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted flex-shrink-0">
                      {view === "canales" ? (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      ) : view === "directos" ? (
                        <span className="text-xs font-bold text-muted-foreground">{"avatar" in item ? (item as typeof directMessages[number]).avatar : ""}</span>
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm truncate", item.unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>{item.name}</p>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{item.lastTime}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {"lastAuthor" in item ? `${(item as typeof channels[number]).lastAuthor}: ` : ""}
                        {item.lastMessage}
                      </p>
                    </div>
                    {item.unread > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background flex-shrink-0">{item.unread}</span>
                    )}
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Sin resultados</p>
              </div>
            )}
          </div>

          {/* Chat view */}
          {selectedThread && (
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-border bg-card flex flex-col" style={{ minHeight: 420 }}>
                {/* Chat header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    {view === "canales" ? <Hash className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    <h3 className="text-sm font-semibold text-foreground">
                      {currentItems.find(i => i.id === selectedThread)?.name || "Conversacion"}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedThread(null)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden" aria-label="Cerrar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {sampleMessages.map(msg => (
                    <div key={msg.id} className={cn("flex gap-3", msg.isOwn && "flex-row-reverse")}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">{msg.avatar}</span>
                      </div>
                      <div className={cn("max-w-[75%]")}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">{msg.author}</span>
                          <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                        </div>
                        <div className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.isOwn ? "bg-foreground text-background" : "bg-muted text-foreground"
                        )}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message input */}
                <div className="border-t border-border p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Adjuntar">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      placeholder="Escribe un mensaje..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background" aria-label="Enviar">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionPage>
    </AppShell>
  )
}
