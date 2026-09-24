"use client"

import { useI18n } from "@/components/i18n-provider"
import { InboxToolbar as StandardInboxToolbar } from "./inbox-toolbar-standard"
import { SimpleInboxToolbar } from "./simple-inbox-toolbar"
import type { InboxToolbarProps } from "./inbox-toolbar-model"

/** One Inbox Core; presentation is selected by the existing workspace contract. */
export function InboxToolbar(props: InboxToolbarProps) {
  const { t } = useI18n()
  if (props.variant === "simple" && !props.isTodoMode) {
    return <SimpleInboxToolbar {...props} messages={t.inbox.toolbar} />
  }
  return <StandardInboxToolbar {...props} />
}
