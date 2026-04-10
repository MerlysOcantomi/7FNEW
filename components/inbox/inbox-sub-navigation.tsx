"use client"

import { Inbox, Circle, Star, Mail, MessageSquare, Clock, CheckCircle, Archive, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type InboxFilter = "all" | "urgent" | "lead" | "unread" | "reply" | "waiting" | "done" | "archived" | "spam"

interface InboxStats {
  total: number
  urgent: number
  leads: number
  unread: number
  reply: number
  waiting: number
  done: number
  archived: number
  spam: number
}

interface InboxSubNavigationProps {
  activeFilter: InboxFilter
  stats: InboxStats
  onFilterChange: (filter: InboxFilter) => void
}

const INBOX_SECTIONS = [
  {
    id: 'all' as const,
    label: 'All',
    icon: Inbox,
    color: 'text-[var(--inbox-text-secondary)]',
    showInMain: true,
  },
  {
    id: 'urgent' as const,
    label: 'Urgent',
    icon: Circle,
    color: 'text-[var(--inbox-urgent-color)] fill-[var(--inbox-urgent-color)]',
    showInMain: true,
  },
  {
    id: 'lead' as const,
    label: 'Lead',
    icon: Star,
    color: 'text-[var(--inbox-lead-color)] fill-[var(--inbox-lead-color)]',
    showInMain: true,
  },
  {
    id: 'unread' as const,
    label: 'Unread',
    icon: Mail,
    color: 'text-[var(--inbox-unread-color)]',
    showInMain: true,
  },
  {
    id: 'reply' as const,
    label: 'Needs Reply',
    icon: MessageSquare,
    color: 'text-[var(--inbox-accent)]',
    showInMain: true,
  },
  {
    id: 'waiting' as const,
    label: 'Waiting',
    icon: Clock,
    color: 'text-[var(--inbox-waiting-color)]',
    showInMain: false, // En dropdown More
  },
  {
    id: 'done' as const,
    label: 'Done',
    icon: CheckCircle,
    color: 'text-[var(--inbox-done-color)]',
    showInMain: false, // En dropdown More
  },
  {
    id: 'archived' as const,
    label: 'Archived',
    icon: Archive,
    color: 'text-[var(--inbox-archive-color)]',
    showInMain: false, // En dropdown More
  },
  {
    id: 'spam' as const,
    label: 'Spam',
    icon: Shield,
    color: 'text-[var(--inbox-spam-color)]',
    showInMain: false, // En dropdown More
  },
]

export function InboxSubNavigation({ activeFilter, stats, onFilterChange }: InboxSubNavigationProps) {
  const getCount = (sectionId: string) => {
    switch (sectionId) {
      case 'all': return stats.total
      case 'urgent': return stats.urgent
      case 'lead': return stats.leads
      case 'unread': return stats.unread
      case 'reply': return stats.reply
      case 'waiting': return stats.waiting
      case 'done': return stats.done
      case 'archived': return stats.archived
      case 'spam': return stats.spam
      default: return 0
    }
  }

  const mainSections = INBOX_SECTIONS.filter(section => section.showInMain)
  const dropdownSections = INBOX_SECTIONS.filter(section => !section.showInMain)

  return (
    <div className="flex flex-wrap items-center gap-1 pb-3 pt-1">
      {/* Secciones principales */}
      {mainSections.map((section) => {
        const count = getCount(section.id)
        const Icon = section.icon
        const isActive = activeFilter === section.id
        
        return (
          <Button
            key={section.id}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "gap-2 h-8 px-3 text-xs transition-all duration-200",
              isActive && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)] hover:bg-[var(--inbox-accent-soft)]"
            )}
            onClick={() => onFilterChange(section.id)}
          >
            <Icon className={cn("h-3 w-3", section.color)} />
            <span className="hidden sm:inline">{section.label}</span>
            {count > 0 && (
              <Badge 
                variant={isActive ? "default" : "secondary"} 
                className={cn(
                  "ml-0.5 h-4 px-1.5 text-[10px] font-medium",
                  isActive ? "bg-[var(--inbox-accent)] text-white" : "bg-[var(--inbox-surface-elevated)] text-[var(--inbox-text-secondary)]"
                )}
              >
                {count}
              </Badge>
            )}
          </Button>
        )
      })}

      {/* Dropdown More */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 h-8 px-2 text-xs text-[var(--inbox-text-secondary)]"
          >
            More
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 8.5L2.5 5h7L6 8.5z" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {dropdownSections.map((section) => {
            const count = getCount(section.id)
            const Icon = section.icon
            const isActive = activeFilter === section.id
            
            return (
              <DropdownMenuItem
                key={section.id}
                className={cn(
                  "gap-2 cursor-pointer",
                  isActive && "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]"
                )}
                onClick={() => onFilterChange(section.id)}
              >
                <Icon className={cn("h-3 w-3", section.color)} />
                <span className="flex-1">{section.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {count}
                  </Badge>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}