"use client"

import { useEffect } from "react"
import { useGlobalSearch } from "@/components/global-search-provider"
import { useTodayDrawer } from "@/components/today/today-drawer-provider"

/** Closes Today when global Search opens (mutual exclusion). */
export function CloseTodayWhenGlobalSearchOpen() {
  const { searchOpen } = useGlobalSearch()
  const { closeToday } = useTodayDrawer()

  useEffect(() => {
    if (searchOpen) closeToday()
  }, [searchOpen, closeToday])

  return null
}
