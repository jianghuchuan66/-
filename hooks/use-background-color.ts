/**
 * 摄影Vibe — 背景色状态管理 Hook
 *
 * 功能：
 *  - 从图片提取主色并预处理
 *  - 应用/移除自定义背景色
 *  - localStorage 持久化（页面刷新自动恢复）
 *  - 文字对比度自动适配
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  extractDominantColor,
  preprocessColor,
  adjustSaturation,
  rgbToHex,
  rgbToCss,
  getTextColor,
  type RGBColor,
} from "@/lib/color-utils"

// ---- localStorage key ----
const STORAGE_KEY = "vibe-custom-bg"
const SATURATION_KEY = "vibe-custom-bg-saturation"

// ---- 默认饱和度（预处理后饱和度保留 60%，滑块也从此开始） ----
const DEFAULT_SATURATION = 60

interface StoredBg {
  hex: string
  r: number
  g: number
  b: number
}

export function useBackgroundColor() {
  // ---- 状态 ----
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // 提取到的原始主色（预处理后）
  const [extractedColor, setExtractedColor] = useState<RGBColor | null>(null)

  // 当前展示色（受饱和度滑块影响）
  const [displayColor, setDisplayColor] = useState<RGBColor | null>(null)

  // 是否已应用背景
  const [hasApplied, setHasApplied] = useState(false)

  // 饱和度滑块值 (0-100)
  const [saturation, setSaturation] = useState(DEFAULT_SATURATION)

  // 是否正在提取中
  const [isExtracting, setIsExtracting] = useState(false)

  // 原始主色（未调整饱和度前的预处理色），用于滑块重新计算
  const baseColorRef = useRef<RGBColor | null>(null)

  // ---- 初始化：从 localStorage 恢复 ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const storedSat = localStorage.getItem(SATURATION_KEY)
      if (stored) {
        const bg: StoredBg = JSON.parse(stored)
        if (bg && typeof bg.hex === 'string' && typeof bg.r === 'number') {
          const color: RGBColor = { r: bg.r, g: bg.g, b: bg.b }
          setExtractedColor(color)
          setDisplayColor(color)
          baseColorRef.current = color
          setHasApplied(true)
          // 恢复饱和度
          if (storedSat) {
            const sat = parseInt(storedSat, 10)
            if (!isNaN(sat) && sat >= 0 && sat <= 100) {
              setSaturation(sat)
            }
          }
          // 应用背景
          applyToDOM(color)
        }
      }
    } catch {
      // 忽略解析错误
    }
  }, [])

  // ---- 饱和度变化 → 更新展示色 ----
  useEffect(() => {
    if (!baseColorRef.current) return
    const factor = saturation / 100
    const adjusted = adjustSaturation(baseColorRef.current, factor)
    setDisplayColor(adjusted)
  }, [saturation])

  // ---- 从图片提取主色 ----
  const extractFromImage = useCallback(async (imageSrc: string) => {
    if (!imageSrc) return

    setIsExtracting(true)
    try {
      // 1. 提取主色
      const raw = await extractDominantColor(imageSrc)

      // 2. 预处理（降饱和、调明度）
      const processed = preprocessColor(raw)

      // 3. 存为基准色
      baseColorRef.current = processed

      // 4. 重置饱和度为默认值
      setSaturation(DEFAULT_SATURATION)

      // 5. 计算展示色
      const display = adjustSaturation(processed, DEFAULT_SATURATION / 100)
      setExtractedColor(processed)
      setDisplayColor(display)

      // 6. 自动打开面板
      setIsPanelOpen(true)
    } catch (err) {
      console.error('[取色] 提取失败:', err)
    } finally {
      setIsExtracting(false)
    }
  }, [])

  // ---- 提取 + 自动应用（上传图片时自动换色） ----
  const extractAndApply = useCallback(async (imageSrc: string) => {
    if (!imageSrc) return

    setIsExtracting(true)
    try {
      // 1. 提取主色
      const raw = await extractDominantColor(imageSrc)

      // 2. 预处理
      const processed = preprocessColor(raw)

      // 3. 存基准色 + 重置饱和度
      baseColorRef.current = processed
      setSaturation(DEFAULT_SATURATION)

      // 4. 计算展示色（预处理 + 默认饱和度）
      const display = adjustSaturation(processed, DEFAULT_SATURATION / 100)
      setExtractedColor(processed)
      setDisplayColor(display)

      // 5. 立即应用到 DOM（不等待用户操作）
      applyToDOM(display)
      setHasApplied(true)
      persistColor(display, DEFAULT_SATURATION)

      // 6. 自动打开面板让用户知道已取色
      setIsPanelOpen(true)
    } catch (err) {
      console.error('[取色] 自动提取失败:', err)
    } finally {
      setIsExtracting(false)
    }
  }, [])

  // ---- 应用背景色到页面（手动） ----
  const applyBackground = useCallback(() => {
    if (!displayColor) return
    applyToDOM(displayColor)
    setHasApplied(true)
    // 持久化
    persistColor(displayColor, saturation)
  }, [displayColor, saturation])

  // ---- 移除背景色 ----
  const removeBackground = useCallback(() => {
    removeFromDOM()
    setHasApplied(false)
    setExtractedColor(null)
    setDisplayColor(null)
    baseColorRef.current = null
    // 清除持久化
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SATURATION_KEY)
  }, [])

  // ---- HEX 值（当前展示色） ----
  const displayHex = displayColor ? rgbToHex(displayColor.r, displayColor.g, displayColor.b) : null

  // ---- 推荐文字颜色 ----
  const textColor = displayColor ? getTextColor(displayColor) : null

  return {
    // 状态
    isPanelOpen,
    setIsPanelOpen,
    isExtracting,
    hasApplied,

    // 颜色数据
    extractedColor,    // 预处理后的基准色
    displayColor,      // 当前展示色（受饱和度影响）
    displayHex,        // 展示色 HEX
    displayRgb: displayColor ? rgbToCss(displayColor) : null,
    textColor,         // 推荐文字色

    // 饱和度
    saturation,
    setSaturation,

    // 操作
    extractFromImage,
    extractAndApply,
    applyBackground,
    removeBackground,
  }
}

// ============================================================
// 内部工具函数
// ============================================================

/** 应用背景色到 DOM（body + html） */
function applyToDOM(color: RGBColor) {
  const cssColor = rgbToCss(color)
  const textColor = getTextColor(color)
  document.documentElement.style.setProperty('--vibe-bg', cssColor)
  document.documentElement.style.setProperty('--vibe-bg-r', String(color.r))
  document.documentElement.style.setProperty('--vibe-bg-g', String(color.g))
  document.documentElement.style.setProperty('--vibe-bg-b', String(color.b))
  document.documentElement.style.setProperty('--vibe-text', textColor)
  document.documentElement.classList.add('vibe-custom-bg')
  document.body.style.backgroundColor = cssColor
}

/** 移除自定义背景色 */
function removeFromDOM() {
  document.documentElement.style.removeProperty('--vibe-bg')
  document.documentElement.style.removeProperty('--vibe-bg-r')
  document.documentElement.style.removeProperty('--vibe-bg-g')
  document.documentElement.style.removeProperty('--vibe-bg-b')
  document.documentElement.style.removeProperty('--vibe-text')
  document.documentElement.classList.remove('vibe-custom-bg')
  document.body.style.backgroundColor = ''
}

/** 持久化到 localStorage */
function persistColor(color: RGBColor, saturation: number) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hex: rgbToHex(color.r, color.g, color.b),
        r: color.r,
        g: color.g,
        b: color.b,
      })
    )
    localStorage.setItem(SATURATION_KEY, String(saturation))
  } catch {
    // 忽略存储失败
  }
}
