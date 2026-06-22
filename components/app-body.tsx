/**
 * App Body 客户端包装 — 提供 CompositionProvider 跨路由状态持久化
 */
"use client"

import { type ReactNode } from "react"
import { CompositionProvider } from "@/contexts/composition-context"

export function AppBody({ children }: { children: ReactNode }) {
  return (
    <CompositionProvider>
      {children}
    </CompositionProvider>
  )
}
