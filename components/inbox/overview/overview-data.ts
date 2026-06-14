import type { LucideIcon } from "lucide-react"
import {
  CalendarClock,
  CheckSquare,
  Clock,
  CloudRain,
  CloudSun,
  FileText,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  Moon,
  Sun,
} from "lucide-react"

/**
 * Smart Inbox — Overview (Option A) demo data + presentation helpers.
 *
 * This module is intentionally DATA-ONLY and uses placeholder/demo content for the
 * briefing screen (see the Option A handoff). Every colour is expressed as a theme
 * token string (CSS custom property) — never a hardcoded hex — so the same data
 * renders correctly in Midnight and Lavender Mist. Real-data wiring (the previous
 * /api/inbox + /api/today fetches) is a documented follow-up; this phase ships the
 * approved visual with demo content, a live clock/date, and descriptive weather.
 */

export type Priority = "high" | "lead" | "normal"

/** Priority → semantic inbox tokens (accent text + soft fill). Tokens only. */
export const PRIORITY_TOKENS: Record<Priority, { accent: string; soft: string }> = {
  high: { accent: "var(--inbox-urgency)", soft: "var(--inbox-urgency-soft)" },
  lead: { accent: "var(--inbox-lead)", soft: "var(--inbox-lead-soft)" },
  normal: { accent: "var(--accent-on-dark)", soft: "var(--accent-muted)" },
}

// ─── Greeting / date / time (live, no backend) ──────────────────────────────

export function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })
}

// ─── Weather (descriptive placeholder — no API; varies by time of day) ───────

export type WeatherTone = "warm" | "info" | "cool"

export interface Weather {
  label: string
  detail: string
  icon: LucideIcon
  tone: WeatherTone
}

/** Maps a weather tone → { accent, soft } tokens. */
export const WEATHER_TOKENS: Record<WeatherTone, { accent: string; soft: string }> = {
  warm: { accent: "var(--inbox-warning)", soft: "var(--inbox-lead-soft)" },
  info: { accent: "var(--inbox-info)", soft: "var(--inbox-info-soft)" },
  cool: { accent: "var(--accent-on-dark)", soft: "var(--accent-muted)" },
}

export function getWeather(date: Date): Weather {
  const h = date.getHours()
  if (h < 12) return { label: "Sunny morning · 23°", detail: "A bright, calm start", icon: Sun, tone: "warm" }
  if (h < 17) return { label: "Warm afternoon · 27°", detail: "Clear skies ahead", icon: CloudSun, tone: "warm" }
  if (h < 21) return { label: "Clear evening · 21°", detail: "Winding down", icon: CloudRain, tone: "info" }
  return { label: "Cool night · 14°", detail: "Quiet and calm", icon: Moon, tone: "cool" }
}

// ─── Channel activity (radar) ───────────────────────────────────────────────

export interface ChannelStat {
  name: string
  count: number
  icon: LucideIcon
  /** Channel accent token. */
  accent: string
  /** 7-bar sparkline (relative 0–1 heights). */
  spark: number[]
}

export const CHANNELS: ChannelStat[] = [
  { name: "Email", count: 5, icon: Mail, accent: "var(--accent-on-dark)", spark: [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.8] },
  { name: "WhatsApp", count: 3, icon: MessageCircle, accent: "var(--inbox-success)", spark: [0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.5] },
  { name: "Web Chat", count: 2, icon: MessageSquare, accent: "var(--inbox-info)", spark: [0.2, 0.4, 0.3, 0.6, 0.5, 0.7, 0.4] },
  { name: "Instagram", count: 1, icon: Instagram, accent: "var(--inbox-lead)", spark: [0.2, 0.3, 0.2, 0.4, 0.3, 0.5, 0.3] },
  { name: "LinkedIn", count: 1, icon: Linkedin, accent: "var(--inbox-info)", spark: [0.1, 0.3, 0.2, 0.3, 0.4, 0.3, 0.5] },
]

export const CHANNEL_CAPTION = "last 12h · 12 incoming"

// ─── Needs action (prioritized by Fanny) ────────────────────────────────────

export interface NeedsActionItem {
  initials: string
  sender: string
  channel: string
  time: string
  preview: string
  action: string
  priority: Priority
}

export const NEEDS_ACTION: NeedsActionItem[] = [
  { initials: "MV", sender: "María Velasco", channel: "Email", time: "8:18", preview: "Followed up about tomorrow's meeting", action: "Reply", priority: "high" },
  { initials: "TI", sender: "Tomás Iglesias", channel: "Web Chat", time: "8:05", preview: "Asked for analytics pricing tiers", action: "Send pricing", priority: "lead" },
  { initials: "CP", sender: "Carla · Pix Studio", channel: "Email", time: "Yest.", preview: "Waiting for portal access confirmation", action: "Confirm", priority: "high" },
  { initials: "AP", sender: "Andrés Pol", channel: "WhatsApp", time: "Yest.", preview: "Q2 budget — two scenarios ready to review", action: "Approve draft", priority: "normal" },
  { initials: "LM", sender: "Laura Méndez", channel: "Email", time: "Mon", preview: "Onboarding kickoff this week", action: "Schedule call", priority: "normal" },
]

// ─── Proposed by Fanny ──────────────────────────────────────────────────────

export interface ProposedItem {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  meta: string
}

export const PROPOSALS: ProposedItem[] = [
  { id: "p1", icon: CheckSquare, title: "Create task", detail: "Send revised proposal to María", meta: "Due today · from Email thread" },
  { id: "p2", icon: FileText, title: "Prepare draft", detail: "Analytics pricing for Tomás", meta: "2 tiers + annual discount" },
  { id: "p3", icon: CalendarClock, title: "Schedule event", detail: "Onboarding kickoff with Laura", meta: "Suggest Wed 10:00" },
  { id: "p4", icon: Clock, title: "Mark as waiting", detail: "Pix Studio portal access", meta: "Follow up in 1 day" },
]

// ─── Ready in Today (bridge — never duplicates Today) ────────────────────────

export const TODAY_READY: string[] = [
  "Send revised proposal — María Velasco",
  "Call Andrés Pol — Q2 budget review",
  "Confirm portal access — Pix Studio",
]

// ─── Waiting / follow-ups ───────────────────────────────────────────────────

export interface WaitingItem {
  label: string
  sub: string
  meta: string
  dot: string
}

export const WAITING: WaitingItem[] = [
  { label: "Client reply pending", sub: "Vértice — Q2 proposal", meta: "2 days", dot: "var(--inbox-info)" },
  { label: "Follow-up tomorrow", sub: "Nimbus Labs", meta: "9:00", dot: "var(--inbox-lead)" },
  { label: "Invoice awaiting confirmation", sub: "Casa Lumen", meta: "$15,200", dot: "var(--inbox-success)" },
  { label: "Call scheduled", sub: "Estudio Verde", meta: "Today 16:00", dot: "var(--accent-on-dark)" },
]

// ─── Open Inbox (work modes) — "Inbox Brief", never "Triage" ─────────────────

export interface InboxMode {
  label: string
  desc: string
  href: string
  icon: LucideIcon
}

export const INBOX_MODES: InboxMode[] = [
  { label: "Inbox Brief", desc: "Clear what needs attention", href: "/inbox?layout=triage", icon: Sun },
  { label: "Reading", desc: "Read threads in focus", href: "/inbox?layout=reading", icon: Mail },
  { label: "Focus", desc: "One conversation at a time", href: "/inbox?layout=focus", icon: MessageSquare },
]
