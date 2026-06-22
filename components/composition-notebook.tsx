/**
 * 构图笔记本 — 主组件
 *
 * 列表页：12 张构图卡片网格
 * 详情页：释义 + 图片上传 + 图库管理 + 放大预览
 *
 * 全部使用 gray-* 色系避免全局 text-white CSS 覆盖冲突
 */

"use client"

import { useRef, useState, useCallback } from "react"
import { useCompositionNotebook } from "@/hooks/use-composition-notebook"
import { cn } from "@/lib/utils"

export function CompositionNotebook() {
  const {
    view,
    selectedId,
    selectedCategory,
    openDetail,
    backToList,
    getImages,
    addImages,
    deleteImage,
    previewSrc,
    openPreview,
    closePreview,
    allCategories,
  } = useCompositionNotebook()

  // ---- 列表页 ----
  if (view === 'list') {
    return <NotebookList categories={allCategories} onSelect={openDetail} />
  }

  // ---- 详情页 ----
  if (view === 'detail' && selectedCategory) {
    return (
      <NotebookDetail
        category={selectedCategory}
        images={getImages(selectedCategory.id)}
        onBack={backToList}
        onAddImages={(files) => addImages(selectedCategory.id, files)}
        onDeleteImage={(i) => deleteImage(selectedCategory.id, i)}
        onPreview={openPreview}
        previewSrc={previewSrc}
        onClosePreview={closePreview}
      />
    )
  }

  return null
}

// ============================================================
// 子组件：构图卡片列表
// ============================================================

function NotebookList({
  categories,
  onSelect,
}: {
  categories: typeof import('@/lib/composition-notebook-data').COMPOSITION_CATEGORIES
  onSelect: (id: string) => void
}) {
  return (
    <div className="py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 标题 */}
        <header className="mb-10 text-center">
          <h1
            className="text-2xl font-semibold tracking-[0.3em] mb-2"
            style={{ color: 'var(--vibe-text, #d1d5db)' }}
          >
            构图笔记本
          </h1>
          <p className="text-sm tracking-widest" style={{ color: '#9ca3af' }}>
            COMPOSITION NOTEBOOK
          </p>
        </header>

        {/* 12 卡片网格 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat, idx) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={cn(
                // 胶片笔记本卡片 — 半透明，适用任意背景色
                'relative text-left p-5 rounded-xl',
                'border border-white/10',
                'bg-white/5 hover:bg-white/10',
                'backdrop-blur-sm',
                'transition-all duration-300',
                'group',
                'min-h-[100px]',
              )}
            >
              {/* 序号 */}
              <span
                className="absolute top-3 right-4 text-xs font-mono"
                style={{ color: '#6b7280' }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>

              {/* 构图名称 */}
              <h3
                className="text-base font-medium tracking-wider leading-snug pr-6"
                style={{ color: 'var(--vibe-text, #e5e7eb)' }}
              >
                {cat.name}
              </h3>

              {/* hover 指示箭头 */}
              <span
                className="absolute bottom-4 right-4 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#9ca3af' }}
              >
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 子组件：构图详情页
// ============================================================

function NotebookDetail({
  category,
  images,
  onBack,
  onAddImages,
  onDeleteImage,
  onPreview,
  previewSrc,
  onClosePreview,
}: {
  category: import('@/lib/composition-notebook-data').CompositionCategory
  images: string[]
  onBack: () => void
  onAddImages: (files: FileList) => Promise<boolean>
  onDeleteImage: (index: number) => void
  onPreview: (src: string) => void
  previewSrc: string | null
  onClosePreview: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFilesChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      setUploading(true)
      try {
        await onAddImages(files)
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [onAddImages],
  )

  return (
    <div className="py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* ======== 顶部：返回按钮 + 标题 ======== */}
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg',
              'border border-white/10 bg-white/5',
              'hover:bg-white/10 hover:border-white/20',
              'transition-all duration-200',
            )}
            style={{ color: 'var(--vibe-text, #d1d5db)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm">返回</span>
          </button>

          <div>
            <h1
              className="text-xl font-semibold tracking-wider"
              style={{ color: 'var(--vibe-text, #e5e7eb)' }}
            >
              {category.name}
            </h1>
          </div>
        </header>

        {/* ======== 释义卡片 ======== */}
        <div
          className={cn(
            'rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm',
            'p-6 mb-8',
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--vibe-text, #9ca3af)' }}
            />
            <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#9ca3af' }}>
              构图释义
            </span>
          </div>
          <p
            className="text-sm leading-relaxed tracking-wide"
            style={{ color: 'var(--vibe-text, #d1d5db)' }}
          >
            {category.description}
          </p>
        </div>

        {/* ======== 图片区域 ======== */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--vibe-text, #9ca3af)' }}
              />
              <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#9ca3af' }}>
                示范图片 · {images.length} 张
              </span>
            </div>

            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                'border border-white/15 bg-white/5',
                'hover:bg-white/10 hover:border-white/25',
                'transition-all duration-200',
                uploading && 'opacity-50 cursor-not-allowed',
              )}
              style={{ color: 'var(--vibe-text, #d1d5db)' }}
            >
              {uploading ? (
                <>
                  <span className="w-3.5 h-3.5 border border-white/30 border-t-white/60 rounded-full animate-spin" />
                  导入中…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  上传图片
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>

          {/* 图库 */}
          {images.length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((src, idx) => (
                <ImageThumbnail
                  key={`${idx}-${src.substring(0, 30)}`}
                  src={src}
                  onPreview={() => onPreview(src)}
                  onDelete={() => onDeleteImage(idx)}
                />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                'rounded-xl border border-dashed border-white/10',
                'flex flex-col items-center justify-center py-16',
                'bg-white/[0.02]',
              )}
              style={{ color: '#6b7280' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-40">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-xs tracking-wider">点击「上传图片」添加示范照片</span>
            </div>
          )}
        </section>
      </div>

      {/* ======== 图片放大预览 ======== */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={onClosePreview}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClosePreview}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-colors"
            style={{ color: '#e5e7eb' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* 图片 */}
          <img
            src={previewSrc}
            alt="预览"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// 子组件：缩略图卡片
// ============================================================

function ImageThumbnail({
  src,
  onPreview,
  onDelete,
}: {
  src: string
  onPreview: () => void
  onDelete: () => void
}) {
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20">
      {/* 图片 */}
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover cursor-pointer"
        onClick={onPreview}
        loading="lazy"
      />

      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={cn(
          'absolute top-1.5 right-1.5 w-6 h-6 rounded-full',
          'bg-black/60 border border-white/15',
          'flex items-center justify-center',
          'opacity-0 group-hover:opacity-100',
          'hover:bg-red-500/60 hover:border-red-400/30',
          'transition-all duration-200',
        )}
        style={{ color: '#d1d5db' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
