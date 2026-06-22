/**
 * 构图状态跨路由持久化 Context
 *
 * Layout 层包裹，页面导航不卸载 → 照片和分析结果不会丢失
 */

"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { CompositionState } from "@/hooks/use-composition"

// ---- Context 类型 ----

interface CompositionContextValue {
  saved: Partial<CompositionState> | null
  save: (state: Partial<CompositionState>) => void
  clear: () => void
}

// ---- 需要持久化的关键字段 ----
const PERSIST_KEYS: (keyof CompositionState)[] = [
  'originalSrc',
  'aiPreviewSrc',
  'customPreviewSrc',
  'imageNaturalW',
  'imageNaturalH',
  'aspectRatio',
  'analysis',
  'sceneInfo',
  'compositions',
  'score',
  'aiCropBox',
  'aiSubjectPoint',
  'primaryComp',
  'backupComp',
  'primaryQuality',
  'editorMode',
  'userCropBox',
  'userSubjectPoint',
  'userRotation',
  'showGuides',
  'apiData',
]

function pickState(full: CompositionState): Partial<CompositionState> {
  const partial: Record<string, unknown> = {}
  for (const key of PERSIST_KEYS) {
    partial[key] = full[key]
  }
  return partial as Partial<CompositionState>
}

// ---- Context ----

const CompositionContext = createContext<CompositionContextValue>({
  saved: null,
  save: () => {},
  clear: () => {},
})

export function useCompositionContext() {
  return useContext(CompositionContext)
}

// ---- Provider ----

export function CompositionProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Partial<CompositionState> | null>(null)

  const save = useCallback((state: CompositionState) => {
    setSaved(pickState(state))
  }, [])

  const clear = useCallback(() => {
    setSaved(null)
  }, [])

  return (
    <CompositionContext.Provider value={{ saved, save, clear }}>
      {children}
    </CompositionContext.Provider>
  )
}
