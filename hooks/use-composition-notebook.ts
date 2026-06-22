/**
 * 构图笔记本 — 状态管理 + localStorage 持久化
 *
 * - 每类构图独立存储 base64 图片数组
 * - 页面刷新/切换功能后图片不丢失
 * - 图片上传时自动压缩至长边 800px，控制 localStorage 体积
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { COMPOSITION_CATEGORIES, type CompositionCategory } from "@/lib/composition-notebook-data"

// ---- localStorage key ----
const STORAGE_KEY = "composition-notebook-images"

// ---- 图片压缩参数 ----
const MAX_LONG_EDGE = 800
const JPEG_QUALITY = 0.75

type ImagesStore = Record<string, string[]>

/** 从 localStorage 读取全部图片 */
function loadImages(): ImagesStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        // 只保留白名单分类的图片（防止脏数据）
        const validIds = new Set(COMPOSITION_CATEGORIES.map(c => c.id))
        const cleaned: ImagesStore = {}
        for (const id of validIds) {
          const arr = parsed[id]
          cleaned[id] = Array.isArray(arr)
            ? arr.filter((s: unknown) => typeof s === 'string' && s.startsWith('data:image/'))
            : []
        }
        return cleaned
      }
    }
  } catch {
    // 解析失败，忽略
  }
  return {}
}

/** 保存全部图片到 localStorage */
function saveImages(store: ImagesStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    // localStorage 满
    return false
  }
}

/** 将 File 转为压缩后的 base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string

      // 不压缩 GIF/SVG
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        resolve(dataUrl)
        return
      }

      const img = new Image()
      img.onload = () => {
        const { width, height } = img
        if (width <= MAX_LONG_EDGE && height <= MAX_LONG_EDGE) {
          resolve(dataUrl)
          return
        }

        // 等比缩放
        const scale = MAX_LONG_EDGE / Math.max(width, height)
        const w = Math.round(width * scale)
        const h = Math.round(height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.onerror = () => reject(new Error('图片处理失败'))
      img.src = dataUrl
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export function useCompositionNotebook() {
  // ---- 视图状态 ----
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ---- 图片存储 ----
  const [images, setImages] = useState<ImagesStore>({})

  // ---- 放大预览 ----
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  // ---- 初始化：从 localStorage 加载 ----
  useEffect(() => {
    setImages(loadImages())
  }, [])

  // ---- 获取当前选中分类 ----
  const selectedCategory: CompositionCategory | null = selectedId
    ? COMPOSITION_CATEGORIES.find(c => c.id === selectedId) ?? null
    : null

  // ---- 获取某分类的图片列表 ----
  const getImages = useCallback(
    (categoryId: string): string[] => images[categoryId] ?? [],
    [images],
  )

  // ---- 进入详情页 ----
  const openDetail = useCallback((categoryId: string) => {
    setSelectedId(categoryId)
    setView('detail')
  }, [])

  // ---- 返回列表页 ----
  const backToList = useCallback(() => {
    setView('list')
    setSelectedId(null)
  }, [])

  // ---- 上传图片到指定分类 ----
  const addImages = useCallback(
    async (categoryId: string, files: FileList | File[]) => {
      const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
      if (fileArr.length === 0) return false

      // 逐个转为 base64
      const newBase64s: string[] = []
      for (const file of fileArr) {
        try {
          const b64 = await fileToBase64(file)
          newBase64s.push(b64)
        } catch {
          // 单张失败跳过
        }
      }

      if (newBase64s.length === 0) return false

      setImages(prev => {
        const existing = prev[categoryId] ?? []
        const updated = { ...prev, [categoryId]: [...existing, ...newBase64s] }
        saveImages(updated)
        return updated
      })

      return true
    },
    [],
  )

  // ---- 删除某分类下指定索引的图片 ----
  const deleteImage = useCallback(
    (categoryId: string, index: number) => {
      setImages(prev => {
        const existing = prev[categoryId] ?? []
        const updated = {
          ...prev,
          [categoryId]: [...existing.slice(0, index), ...existing.slice(index + 1)],
        }
        saveImages(updated)
        return updated
      })
    },
    [],
  )

  // ---- 打开/关闭预览 ----
  const openPreview = useCallback((src: string) => setPreviewSrc(src), [])
  const closePreview = useCallback(() => setPreviewSrc(null), [])

  return {
    // 视图
    view,
    selectedId,
    selectedCategory,
    openDetail,
    backToList,

    // 图片
    getImages,
    addImages,
    deleteImage,

    // 预览
    previewSrc,
    openPreview,
    closePreview,

    // 全部分类
    allCategories: COMPOSITION_CATEGORIES,
  }
}
