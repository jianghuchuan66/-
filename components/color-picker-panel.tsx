/**
 * 摄影Vibe — 取色悬浮面板
 *
 * 极简胶片测光表风格：
 *  - 暗灰机身质感底色
 *  - 单一主色色卡 + HEX/RGB 色值
 *  - 复制色值、饱和度滑块、应用/移除背景色
 */

"use client"

import { useState, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { RGBColor } from "@/lib/color-utils"

interface ColorPickerPanelProps {
  // 面板控制
  isOpen: boolean
  onToggle: () => void

  // 颜色数据
  extractedColor: RGBColor | null
  displayColor: RGBColor | null
  displayHex: string | null
  displayRgb: string | null
  textColor: '#000000' | '#ffffff' | null

  // 饱和度
  saturation: number
  onSaturationChange: (v: number) => void

  // 操作
  isExtracting: boolean
  hasApplied: boolean
  onExtractFromCurrent: () => void
  onApply: () => void
  onRemove: () => void
}

export function ColorPickerPanel({
  isOpen,
  onToggle,
  extractedColor,
  displayColor,
  displayHex,
  displayRgb,
  textColor,
  saturation,
  onSaturationChange,
  isExtracting,
  hasApplied,
  onExtractFromCurrent,
  onApply,
  onRemove,
}: ColorPickerPanelProps) {
  const [copied, setCopied] = useState(false)

  // ---- 复制色值 ----
  const handleCopy = useCallback(async () => {
    if (!displayHex) return
    try {
      await navigator.clipboard.writeText(displayHex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 降级方案
      const ta = document.createElement('textarea')
      ta.value = displayHex
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [displayHex])

  // ---- 饱和度滑块 ----
  const handleSaturationChange = useCallback(
    (values: number[]) => {
      onSaturationChange(values[0])
    },
    [onSaturationChange]
  )

  return (
    <>
      {/* ======== 触发按钮（始终显示，固定在右下角） ======== */}
      <button
        onClick={onToggle}
        className={cn(
          'fixed bottom-6 right-6 z-[9999]',
          'w-12 h-12 rounded-full',
          // 醒目的暗色背景 + 明显边框
          'bg-[#2d2d2d] border-2 border-white/25',
          // 外发光让你一眼看到
          'shadow-[0_0_16px_rgba(255,255,255,0.12)]',
          'flex items-center justify-center',
          'hover:border-white/50 hover:bg-[#3a3a3a] hover:shadow-[0_0_24px_rgba(255,255,255,0.2)]',
          'active:scale-95',
          'transition-all duration-200',
          hasApplied && 'ring-2 ring-offset-2 ring-offset-transparent',
        )}
        style={
          hasApplied && displayColor
            ? ({
                ringColor: `rgb(${displayColor.r},${displayColor.g},${displayColor.b})`,
              } as React.CSSProperties)
            : undefined
        }
        title="取色面板"
      >
        {/* 取色器图标 — 白色内联 stroke 绕过全局 text-white 覆盖 */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={hasApplied && displayColor ? `rgb(${displayColor.r},${displayColor.g},${displayColor.b})` : '#ffffff'}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </button>

      {/* ======== 展开面板 ======== */}
      <div
        data-vibe-panel=""
        className={cn(
          // 定位
          'fixed bottom-20 right-6 z-40',
          // 胶片测光表风格 — 暗灰背景，细腻边框
          'bg-[#1a1a1a]/95 backdrop-blur-xl',
          'border border-white/10',
          'rounded-xl',
          'shadow-2xl shadow-black/40',
          'w-64',
          // 过渡动画
          'transition-all duration-300 origin-bottom-right',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none',
        )}
      >
        {/* ---- 面板标题栏 ---- */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <span className="text-xs font-medium tracking-[0.15em] text-white/40 uppercase">
            取色面板
          </span>
          <button
            onClick={onToggle}
            className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/60 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ---- 分隔线 ---- */}
        <div className="mx-4 h-px bg-white/5" />

        {/* ---- 色卡展示区 ---- */}
        <div className="px-4 pt-4 pb-3">
          {displayColor ? (
            <>
              {/* 色卡 — 带内阴影模拟胶片色块质感 */}
              <div
                className="w-full h-20 rounded-lg border border-white/10 shadow-inner transition-colors duration-300"
                style={{
                  backgroundColor: `rgb(${displayColor.r},${displayColor.g},${displayColor.b})`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15)',
                }}
              />

              {/* 色值信息 */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  {/* HEX */}
                  <button
                    onClick={handleCopy}
                    className="text-left text-sm font-mono font-medium tracking-wider text-white/80 hover:text-white transition-colors"
                    title="点击复制 HEX"
                  >
                    {displayHex}
                  </button>
                  {/* RGB */}
                  <span className="text-[11px] font-mono text-white/35">
                    {displayRgb}
                  </span>
                </div>

                {/* 复制按钮 */}
                <button
                  onClick={handleCopy}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                    copied
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70',
                  )}
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              </div>
            </>
          ) : (
            /* 空状态 */
            <div className="h-20 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-white/20 text-xs">
              {isExtracting ? '提取中…' : '点击下方按钮取色'}
            </div>
          )}
        </div>

        {/* ---- 饱和度滑块 ---- */}
        {displayColor && (
          <>
            <div className="mx-4 h-px bg-white/5" />
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/40 tracking-wide">饱和度</span>
                <span className="text-[11px] font-mono text-white/50 tabular-nums">
                  {saturation}%
                </span>
              </div>
              <Slider
                value={[saturation]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleSaturationChange}
                className="[&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-white/40 [&_[data-slot=slider-thumb]]:border-white/40 [&_[data-slot=slider-thumb]]:bg-[#2a2a2a] [&_[data-slot=slider-thumb]]:size-3.5"
              />
            </div>
          </>
        )}

        {/* ---- 分隔线 ---- */}
        <div className="mx-4 h-px bg-white/5" />

        {/* ---- 操作按钮区 ---- */}
        <div className="px-4 py-3 flex flex-col gap-2">
          {/* 读取当前图片 */}
          <button
            onClick={onExtractFromCurrent}
            disabled={isExtracting}
            className={cn(
              'w-full py-2 rounded-lg text-xs font-medium transition-all',
              'bg-white/5 border border-white/10 text-white/60',
              'hover:bg-white/10 hover:text-white/80 hover:border-white/20',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2',
            )}
          >
            {isExtracting ? (
              <>
                <span className="w-3 h-3 border border-white/30 border-t-white/60 rounded-full animate-spin" />
                提取中…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                读取当前图片取色
              </>
            )}
          </button>

          {/* 应用 / 移除 */}
          {hasApplied ? (
            <button
              onClick={onRemove}
              className="w-full py-2 rounded-lg text-xs font-medium transition-all bg-white/5 border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
            >
              移除背景色
            </button>
          ) : (
            <button
              onClick={onApply}
              disabled={!displayColor}
              className={cn(
                'w-full py-2 rounded-lg text-xs font-medium transition-all',
                displayColor
                  ? 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
                  : 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed',
              )}
            >
              应用背景色
            </button>
          )}
        </div>
      </div>
    </>
  )
}
