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
      <SectionPage title="Communication" description="Internal team messages, client threads, and channels by area." tone="canvas">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Channels</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{channels.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Direct messages</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{directMessages.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Client threads</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{clientThreads.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary-light)]">Unread</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary-light)]">{totalUnread}</p>
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
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors capitalize border",
                  view === v
                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-white/[0.04] hover:text-[var(--text-primary-light)]",
                )}
              >
                {v}
              </button>
            ))}
            <button className="ml-auto flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-medium text-white transition-opacity hover:opacity-85">
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2 ring-1 ring-white/[0.04]">
            <Search className="h-4 w-4 text-[var(--text-secondary-light)] shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] outline-none"
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
                    "w-full rounded-xl border px-4 py-3 text-left transition-all",
                    isSelected
                      ? "border-[var(--accent-primary)]/45 bg-[var(--accent-primary)]/10 ring-1 ring-white/[0.05]"
                      : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-dark-elevated)]">
                      {view === "channels" ? (
                        <Hash className="h-4 w-4 text-[var(--text-secondary-light)]" />
                      ) : view === "direct" ? (
                        <span className="text-xs font-bold text-[var(--text-secondary-light)]">{"avatar" in item ? (item as typeof directMessages[number]).avatar : ""}</span>
                      ) : (
                        <Users className="h-4 w-4 text-[var(--text-secondary-light)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm", item.unread > 0 ? "font-semibold text-[var(--text-primary-light)]" : "font-medium text-[var(--text-primary-light)]")}>{item.name}</p>
                        <span className="flex-shrink-0 text-[10px] text-[var(--text-secondary-light)]">{item.lastTime}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary-light)]">
                        {"lastAuthor" in item ? `${(item as typeof channels[number]).lastAuthor}: ` : ""}
                        {item.lastMessage}
                      </p>
                    </div>
                    {item.unread > 0 && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[10px] font-bold text-white">{item.unread}</span>
                    )}
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-8 text-center ring-1 ring-white/[0.03]">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-[var(--text-secondary-light)]/35" />
                <p className="text-sm font-medium text-[var(--text-primary-light)]">No results</p>
              </div>
            )}
          </div>

          {/* Chat view */}
          {selectedThread && (
            <div className="lg:col-span-3">
              <div className="flex flex-col rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] ring-1 ring-white/[0.04]" style={{ minHeight: 420 }}>
                {/* Chat header */}
                <div className="flex items-center justify-between border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-5 py-3">
                  <div className="flex items-center gap-2">
                    {view === "channels" ? <Hash className="h-4 w-4 text-[var(--text-secondary-light)]" /> : <User className="h-4 w-4 text-[var(--text-secondary-light)]" />}
                    <h3 className="text-sm font-semibold text-[var(--text-primary-light)]">
                      {currentItems.find(i => i.id === selectedThread)?.name || "Conversation"}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedThread(null)} className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary-light)] lg:hidden" aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {sampleMessages.map(msg => (
                    <div key={msg.id} className={cn("flex gap-3", msg.isOwn && "flex-row-reverse")}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-dark-elevated)]">
                        <span className="text-[10px] font-bold text-[var(--text-secondary-light)]">{msg.avatar}</span>
                      </div>
                      <div className={cn("max-w-[85%] sm:max-w-[75%]")}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--text-primary-light)]">{msg.author}</span>
                          <span className="text-[10px] text-[var(--text-secondary-light)]">{msg.time}</span>
                        </div>
                        <div className={cn(
                          "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.isOwn ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--app-surface-dark-elevated)] text-[var(--text-primary-light)] ring-1 ring-white/[0.04]",
                        )}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message input */}
                <div className="border-t border-[var(--border-dark)] p-3">
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-2 ring-1 ring-white/[0.03]">
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary-light)] transition-colors hover:text-[var(--text-primary-light)]" aria-label="Attach">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      placeholder="Write a message..."
                      className="flex-1 bg-transparent text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] outline-none"
                    />
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-primary)] text-white transition-opacity hover:opacity-90" aria-label="Send">
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
