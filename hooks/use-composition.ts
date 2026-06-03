"use client"

import { useState, useCallback, useRef } from "react"
import type {
  AnalysisResult, SceneInfo, Compositions, CropBox, SubjectPoint
} from "@/lib/composition-engine"
import {
  analyzeImage, getCropBox, getSubjectPoint
} from "@/lib/composition-engine"

// ---- 类型 ----

export type EditorMode = 'ai' | 'edit'

// 后端 API 返回的数据结构
export interface ApiAnalysisData {
  "主体类型": string
  "构图类型": string
  "原图宽度": number
  "原图高度": number
  "左裁百分比": number
  "右裁百分比": number
  "上裁百分比": number
  "下裁百分比": number
  "推荐画幅": string
  "构图评分": number
  "构图报告": string
  "裁剪方案": string
  "理由": string
  "AI优化建议": string
}

export interface CompositionState {
  // 图片
  originalSrc: string | null
  aiPreviewSrc: string | null
  customPreviewSrc: string | null
  imageNaturalW: number
  imageNaturalH: number
  aspectRatio: number

  // 分析
  analysis: AnalysisResult | null
  sceneInfo: SceneInfo | null
  compositions: Compositions | null
  score: number

  // AI推荐
  aiCropBox: CropBox
  aiSubjectPoint: SubjectPoint
  primaryComp: string
  backupComp: string
  primaryQuality: 'great' | 'good' | 'issue'

  // 用户编辑
  editorMode: EditorMode
  userCropBox: CropBox
  userSubjectPoint: SubjectPoint
  userRotation: number

  // 辅助线
  showGuides: boolean

  // ---- AI API 相关状态 ----
  /** 是否正在调用 AI 分析 */
  isAnalyzing: boolean
  /** AI 分析错误信息 */
  analysisError: string | null
  /** 后端返回的原始 AI 分析数据 */
  apiData: ApiAnalysisData | null
}

const DEFAULT_CROP: CropBox = { x: 0, y: 0, w: 1, h: 1 }
const DEFAULT_POINT: SubjectPoint = { x: 0.5, y: 0.45 }

// 构图类型中文名 → 英文 key 映射
const COMP_NAME_TO_KEY: Record<string, string> = {
  '三分构图': 'thirds',
  '对称': 'symmetry',
  '对称构图': 'symmetry',
  '对比构图': 'contrast',
  '引导线': 'leading',
  '引导线构图': 'leading',
  '框架构图': 'frame',
  '分层构图': 'layering',
  '点构图': 'point',
  '重复元素构图': 'repeat',
  '动态构图': 'dynamic',
  '中央构图': 'center',
  '留白': 'whitespace',
  '留白构图': 'whitespace',
  '几何形状构图': 'geometry',
  '黄金分割': 'thirds',
}

// 画幅字符串 → 比例数值
function aspectRatioToNumber(ratio: string): number {
  const map: Record<string, number> = {
    '1:1': 1,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '16:9': 16 / 9,
    '3:4': 3 / 4,
    '9:16': 9 / 16,
  }
  return map[ratio] ?? 4 / 3
}

export function useComposition() {
  const [state, setState] = useState<CompositionState>({
    originalSrc: null,
    aiPreviewSrc: null,
    customPreviewSrc: null,
    imageNaturalW: 0,
    imageNaturalH: 0,
    aspectRatio: 4/3,
    analysis: null,
    sceneInfo: null,
    compositions: null,
    score: 0,
    aiCropBox: DEFAULT_CROP,
    aiSubjectPoint: DEFAULT_POINT,
    primaryComp: 'thirds',
    backupComp: 'center',
    primaryQuality: 'good',
    editorMode: 'ai',
    userCropBox: DEFAULT_CROP,
    userSubjectPoint: DEFAULT_POINT,
    userRotation: 0,
    showGuides: true,
    isAnalyzing: false,
    analysisError: null,
    apiData: null,
  })

  const offscreenRef = useRef<HTMLCanvasElement | null>(null)

  /** 获取离屏Canvas用于像素分析 */
  const getOffscreenCanvas = useCallback((w: number, h: number) => {
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas')
    }
    offscreenRef.current.width = w
    offscreenRef.current.height = h
    return offscreenRef.current
  }, [])

  /**
   * 将后端四边裁剪百分比转换为像素坐标 CropBox
   *
   * 计算公式：
   *   x1 = 原图宽度 × 左百分比 ÷ 100
   *   y1 = 原图高度 × 上百分比 ÷ 100
   *   x2 = 原图宽度 × (1 - 右百分比 ÷ 100)
   *   y2 = 原图高度 × (1 - 下百分比 ÷ 100)
   *
   * 边界校验：x1≥0、y1≥0、x2≤原图宽度、y2≤原图高度
   */
  function percentagesToCropBox(
    leftPct: number, rightPct: number, topPct: number, bottomPct: number,
    natW: number, natH: number
  ): CropBox {
    // 像素坐标计算
    const x1 = (natW * leftPct) / 100
    const y1 = (natH * topPct) / 100
    const x2 = natW * (1 - rightPct / 100)
    const y2 = natH * (1 - bottomPct / 100)

    // 边界校验
    const cx = Math.max(0, x1)
    const cy = Math.max(0, y1)
    const cx2 = Math.min(natW, x2)
    const cy2 = Math.min(natH, y2)

    const cw = Math.max(1, cx2 - cx)
    const ch = Math.max(1, cy2 - cy)

    return {
      x: cx / natW,
      y: cy / natH,
      w: cw / natW,
      h: ch / natH,
    }
  }

  /** 核心：加载图片 → AI 分析 → 生成推荐 */
  const loadAndAnalyze = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const img = new window.Image()
        img.crossOrigin = "anonymous"
        img.onload = async () => {
          const natW = img.naturalWidth
          const natH = img.naturalHeight
          const ratio = natW / natH

          // ---- 阶段1: 先显示图片，设置基本状态 ----
          setState(prev => ({
            ...prev,
            originalSrc: dataUrl,
            aiPreviewSrc: dataUrl,
            customPreviewSrc: dataUrl,
            imageNaturalW: natW,
            imageNaturalH: natH,
            aspectRatio: ratio,
            isAnalyzing: true,
            analysisError: null,
          }))

          // ---- 阶段2: 提取 base64 并调用 AI 分析 API ----
          try {
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

            const apiResponse = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: base64, width: natW, height: natH }),
            })

            if (!apiResponse.ok) {
              throw new Error(`API 返回状态码 ${apiResponse.status}`)
            }

            const apiResult = await apiResponse.json()

            if (apiResult.code !== 200 || !apiResult.data) {
              throw new Error(apiResult.msg || 'AI 分析失败')
            }

            const apiData: ApiAnalysisData = apiResult.data

            // ---- 阶段3: 百分比 → 裁剪框坐标 ----
            const leftPct = clamp(apiData.左裁百分比, 0, 50)
            const rightPct = clamp(apiData.右裁百分比, 0, 50)
            const topPct = clamp(apiData.上裁百分比, 0, 50)
            const bottomPct = clamp(apiData.下裁百分比, 0, 50)

            const cropBox = percentagesToCropBox(
              leftPct, rightPct, topPct, bottomPct,
              natW, natH
            )

            // 主体点位锁定在裁剪框内部（中心偏上）
            const subjectPt: SubjectPoint = {
              x: cropBox.x + cropBox.w * 0.5,
              y: cropBox.y + cropBox.h * 0.4,
            }

            const primaryComp = COMP_NAME_TO_KEY[apiData.构图类型] || 'thirds'
            const newAspectRatio = aspectRatioToNumber(apiData.推荐画幅)

            setState(prev => ({
              ...prev,
              isAnalyzing: false,
              analysisError: null,
              apiData,
              score: apiData.构图评分,
              primaryComp,
              backupComp: primaryComp === 'thirds' ? 'center' : 'thirds',
              primaryQuality: apiData.构图评分 >= 85 ? 'great' : apiData.构图评分 >= 70 ? 'good' : 'issue',
              aiCropBox: cropBox,
              aiSubjectPoint: subjectPt,
              userCropBox: cropBox,
              userSubjectPoint: subjectPt,
              userRotation: 0,  // 不自动旋转，留给用户手动调整
              aspectRatio: newAspectRatio,
              editorMode: 'ai',
            }))

            resolve()
          } catch (apiError) {
            console.error('[useComposition] AI 分析失败:', apiError)
            setState(prev => ({
              ...prev,
              isAnalyzing: false,
              analysisError: 'AI分析失败，请重试',
            }))
            resolve()
          }
        }
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = dataUrl
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }, [getOffscreenCanvas])

  /** 切换辅助线 */
  const toggleGuides = useCallback(() => {
    setState(prev => ({ ...prev, showGuides: !prev.showGuides }))
  }, [])

  /** 应用AI推荐 (回到AI方案) */
  const applyAI = useCallback(() => {
    setState(prev => ({
      ...prev,
      editorMode: 'ai',
      userCropBox: prev.aiCropBox,
      userSubjectPoint: prev.aiSubjectPoint,
      userRotation: 0,
      customPreviewSrc: prev.aiPreviewSrc,
    }))
  }, [])

  /** 进入编辑模式 */
  const enterEditMode = useCallback(() => {
    setState(prev => ({ ...prev, editorMode: 'edit' }))
  }, [])

  /** 更新用户裁剪框 */
  const updateUserCropBox = useCallback((box: CropBox) => {
    setState(prev => ({
      ...prev,
      editorMode: 'edit',
      userCropBox: box,
    }))
  }, [])

  /** 更新用户主体点位 */
  const updateUserSubjectPoint = useCallback((pt: SubjectPoint) => {
    setState(prev => ({
      ...prev,
      editorMode: 'edit',
      userSubjectPoint: pt,
    }))
  }, [])

  /** 更新用户旋转（仅手动调整） */
  const updateUserRotation = useCallback((deg: number) => {
    setState(prev => ({
      ...prev,
      editorMode: 'edit',
      userRotation: clamp(deg, -10, 10),
    }))
  }, [])

  /** 确认修改 */
  const confirmEdit = useCallback(() => {
    setState(prev => ({
      ...prev,
      editorMode: 'edit',
    }))
  }, [])

  /** 重置全部 */
  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      originalSrc: null,
      aiPreviewSrc: null,
      customPreviewSrc: null,
      imageNaturalW: 0,
      imageNaturalH: 0,
      aspectRatio: 4/3,
      analysis: null,
      sceneInfo: null,
      compositions: null,
      score: 0,
      aiCropBox: DEFAULT_CROP,
      aiSubjectPoint: DEFAULT_POINT,
      primaryComp: 'thirds',
      backupComp: 'center',
      primaryQuality: 'good',
      editorMode: 'ai',
      userCropBox: DEFAULT_CROP,
      userSubjectPoint: DEFAULT_POINT,
      userRotation: 0,
      showGuides: true,
      isAnalyzing: false,
      analysisError: null,
      apiData: null,
    }))
  }, [])

  return {
    state,
    loadAndAnalyze,
    toggleGuides,
    applyAI,
    enterEditMode,
    updateUserCropBox,
    updateUserSubjectPoint,
    updateUserRotation,
    confirmEdit,
    reset,
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
