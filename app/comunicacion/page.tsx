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
  { id: "general", name: "General", type: "channel", unread: 2, lastMessage: "Reminder: tomorrow's review meeting is at 10am.", lastAuthor: "Carlos M.", lastTime: "1h ago" },
  { id: "diseno", name: "Design", type: "channel", unread: 0, lastMessage: "I uploaded the latest logo variations to Drive.", lastAuthor: "Ana R.", lastTime: "3h ago" },
  { id: "desarrollo", name: "Development", type: "channel", unread: 1, lastMessage: "The staging deploy is ready.", lastAuthor: "Miguel T.", lastTime: "2h ago" },
  { id: "marketing", name: "Marketing", type: "channel", unread: 0, lastMessage: "This week's content is scheduled.", lastAuthor: "Isabela C.", lastTime: "5h ago" },
]

const directMessages = [
  { id: "dm-1", name: "Ana Rodriguez", type: "direct", unread: 1, lastMessage: "Can you review the mockups I uploaded?", lastTime: "30m ago", avatar: "AR" },
  { id: "dm-2", name: "Carlos Mendez", type: "direct", unread: 0, lastMessage: "Perfect, I'll schedule the meeting.", lastTime: "2h ago", avatar: "CM" },
  { id: "dm-3", name: "Laura Chen", type: "direct", unread: 0, lastMessage: "The budget is already approved.", lastTime: "4h ago", avatar: "LC" },
  { id: "dm-4", name: "Sofia Torres", type: "direct", unread: 0, lastMessage: "I sent the brief by email.", lastTime: "1d ago", avatar: "ST" },
  { id: "dm-5", name: "Roberto Diaz", type: "direct", unread: 0, lastMessage: "The API endpoint is ready.", lastTime: "1d ago", avatar: "RD" },
]

const clientThreads = [
  { id: "ct-1", name: "Active client - Proposal review", type: "client", unread: 2, lastMessage: "Hi, I reviewed the proposal and I have a few comments about the cost section...", lastAuthor: "Maria Lopez (client)", lastTime: "1h ago" },
  { id: "ct-2", name: "Active project - Phase approval", type: "client", unread: 0, lastMessage: "The client approved the discovery phase. We can move forward.", lastAuthor: "Roberto D.", lastTime: "3h ago" },
  { id: "ct-3", name: "Active client - Final delivery", type: "client", unread: 0, lastMessage: "The final presentation is ready. I'm sharing the review link.", lastAuthor: "Sofia T.", lastTime: "5h ago" },
  { id: "ct-4", name: "New project - Kickoff", type: "client", unread: 0, lastMessage: "We confirm the start date for March 1.", lastAuthor: "Valentina M.", lastTime: "1d ago" },
]

const sampleMessages = [
  { id: "m1", author: "Carlos Mendez", avatar: "CM", text: "Good morning team. Reminder that tomorrow we have the monthly review meeting at 10am.", time: "09:15", isOwn: false },
  { id: "m2", author: "Ana Rodriguez", avatar: "AR", text: "Confirmed. I'll prepare the design progress presentation.", time: "09:22", isOwn: false },
  { id: "m3", author: "You", avatar: "AD", text: "Perfect. I'll prepare the finance summary and project status update.", time: "09:30", isOwn: true },
  { id: "m4", author: "Laura Chen", avatar: "LC", text: "I can share my screen for the delivery timeline if that helps.", time: "09:35", isOwn: false },
  { id: "m5", author: "Carlos Mendez", avatar: "CM", text: "Excellent, sounds good. See you tomorrow.", time: "09:40", isOwn: false },
]

type ViewType = "channels" | "direct" | "clients"

export default function ComunicacionPage() {
  const [view, setView] = useState<ViewType>("channels")
  const [search, setSearch] = useState("")
  const [selectedThread, setSelectedThread] = useState<string | null>("general")

  const currentItems = view === "channels" ? channels : view === "direct" ? directMessages : clientThreads
  const filtered = currentItems.filter(item => search === "" || item.name.toLowerCase().includes(search.toLowerCase()))

  const totalUnread = [...channels, ...directMessages, ...clientThreads].reduce((a, c) => a + c.unread, 0)

  return (
    <AppShell currentSection="comunicacion" breadcrumbs={[{ label: "7F" }, { label: "Communication" }]}>
      <SectionPage title="Communication" description="Internal team messages, client threads, and channels by area.">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channels</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{channels.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Direct messages</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{directMessages.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client threads</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{clientThreads.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unread</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{totalUnread}</p>
          </div>
        </div>

        {/* View tabs + search */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(["channels", "direct", "clients"] as ViewType[]).map(v => (
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
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Thread list + chat view */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Thread list */}
          <div className={cn("flex flex-col gap-1.5", selectedThread ? "hidden lg:flex lg:col-span-2" : "lg:col-span-5")}>
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
                      {view === "channels" ? (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      ) : view === "direct" ? (
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
                <p className="text-sm font-medium text-foreground">No results</p>
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
                    {view === "channels" ? <Hash className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    <h3 className="text-sm font-semibold text-foreground">
                      {currentItems.find(i => i.id === selectedThread)?.name || "Conversation"}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedThread(null)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden" aria-label="Close">
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
                      <div className={cn("max-w-[85%] sm:max-w-[75%]")}>
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
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Attach">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      placeholder="Write a message..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background" aria-label="Send">
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
