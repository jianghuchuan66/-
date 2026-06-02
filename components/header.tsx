"use client"

import { Button } from "@/components/ui/button"

interface HeaderProps {
  onUpload: () => void
  onApplyAI: () => void
  onSave: () => void
  onReset: () => void
  hasImage?: boolean
}

export function Header({ onUpload, onApplyAI, onSave, onReset }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-white tracking-wide">AI 构图分析 Pro</h1>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onUpload}
          className="gap-2 bg-transparent border-white/20 text-white/90 hover:bg-white/10 hover:border-white/40 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          上传图片
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyAI}
          className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          应用 AI 推荐
        </Button>
        <div className="w-px h-6 bg-white/20" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          重置
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          className="gap-2 bg-white text-black hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          保存
        </Button>
      </div>
    </header>
  )
}
