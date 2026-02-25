"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useUser } from "@/hooks/use-user"
import { CanEdit } from "@/components/role-gate"
import { cn } from "@/lib/utils"
import { Send, Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useFetch } from "@/hooks/use-fetch"

interface Comment {
  id: string
  userName: string | null
  userEmail: string | null
  data: { comment: string; mentions?: string[] } | null
  createdAt: string
}

interface CommentsSectionProps {
  module: string
  recordId: string
  onCommentAdded?: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "ahora"
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.split(" ")
    return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase()
  }
  return email ? email.slice(0, 2).toUpperCase() : "?"
}

export function CommentsSection({ module, recordId, onCommentAdded }: CommentsSectionProps) {
  const { user } = useUser()
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: rawActivities, refetch } = useFetch<Comment[]>(
    `/api/activity?module=${module}&recordId=${recordId}&limit=100`
  )

  const comments = (Array.isArray(rawActivities) ? rawActivities : []).filter(
    (a) => a.data?.comment
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, recordId, comment: trimmed }),
      })
      if (!res.ok) throw new Error("Error al enviar")
      setText("")
      refetch()
      onCommentAdded?.()
      toast.success("Comentario agregado")
    } catch {
      toast.error("Error al enviar comentario")
    } finally {
      setSending(false)
    }
  }, [text, sending, module, recordId, refetch, onCommentAdded])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [text])

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Comentarios</h2>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      {/* Comment input */}
      <CanEdit>
        <div className="flex gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground flex-shrink-0 mt-0.5">
            {getInitials(user?.nombre, user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comentario... (Ctrl+Enter para enviar)"
              rows={1}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-muted-foreground">
                Usa @nombre para mencionar
              </p>
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || sending}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  text.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Enviar
              </button>
            </div>
          </div>
        </div>
      </CanEdit>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">Sin comentarios aun.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground flex-shrink-0 mt-0.5">
                {getInitials(c.userName, c.userEmail)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    {c.userName ?? c.userEmail ?? "Sistema"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap break-words">
                  {c.data?.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
