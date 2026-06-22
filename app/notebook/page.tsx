/**
 * 构图笔记本页面路由
 * 访问路径：/notebook
 *
 * 背景 UI 与照片分析页完全一致：
 * - ParticleBackground 白色粒子
 * - 动态背景色（跟随全局取色）
 */
"use client"

import Link from "next/link"
import { CompositionNotebook } from "@/components/composition-notebook"
import { ParticleBackground } from "@/components/particle-background"
import { useBackgroundColor } from "@/hooks/use-background-color"

export default function NotebookPage() {
  const { hasApplied, displayColor } = useBackgroundColor()

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden bg-[#080808]"
      style={
        hasApplied && displayColor
          ? {
              backgroundColor: `rgb(${displayColor.r},${displayColor.g},${displayColor.b})`,
              transition: 'background-color 0.6s ease',
            }
          : { transition: 'background-color 0.6s ease' }
      }
    >
      {/* 白色粒子背景 — 与主页一致 */}
      <ParticleBackground
        customBgColor={
          hasApplied && displayColor
            ? { r: displayColor.r, g: displayColor.g, b: displayColor.b }
            : null
        }
      />

      {/* 返回首页按钮（左上） */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-[#2d2d2d]/90 border border-white/15 backdrop-blur-sm hover:bg-[#3a3a3a] hover:border-white/30 transition-all duration-200"
        style={{ color: '#d1d5db' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="text-xs tracking-wider">返回分析页</span>
      </Link>

      {/* 笔记本主体 — 背景透明，让粒子透出 */}
      <div className="relative z-10 flex-1">
        <CompositionNotebook />
      </div>
    </div>
  )
}
