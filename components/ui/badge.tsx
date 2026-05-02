import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        // Status Variants
        'status-new': 'border-transparent bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
        'status-triaged': 'border-transparent bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
        'status-assigned': 'border-transparent bg-[var(--status-accent-bg)] text-[var(--status-accent-text)]',
        'status-awaiting-response': 'border-transparent bg-[var(--status-notice-bg)] text-[var(--status-notice-text)]',
        'status-lead-detected': 'border-transparent bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
        'status-resolved': 'border-transparent bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
        'status-converted': 'border-transparent bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
        'status-closed': 'border-transparent bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',
        // Urgency Variants
        'urgency-critical': 'border-transparent bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
        'urgency-high': 'border-transparent bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
        'urgency-medium': 'border-transparent bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
        'urgency-low': 'border-transparent bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',
        // Action Variants
        'action-suggested': 'border-transparent bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
        'action-approved': 'border-transparent bg-[var(--status-accent-bg)] text-[var(--status-accent-text)]',
        'action-executed': 'border-transparent bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
        'action-dismissed': 'border-transparent bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',
        'action-failed': 'border-transparent bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
