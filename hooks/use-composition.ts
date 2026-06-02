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
  "画面倾斜角度": number
  "推荐旋转角度": number
  "最优裁剪框": number[]
  "推荐画幅": string
  "构图评分": number
  "构图报告": string
  "优化建议": string
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

  // ---- 新增：AI API 相关状态 ----
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
    // 新增状态初始值
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
            // 从 dataUrl 中提取纯净的 base64 字符串
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

            // ---- 阶段3: 将 API 数据映射到状态（严格边界校验） ----
            // 使用 API 返回的原图尺寸作为权威边界（优先于 natW/natH）
            const boundaryW = apiData.原图宽度 > 0 ? apiData.原图宽度 : natW
            const boundaryH = apiData.原图高度 > 0 ? apiData.原图高度 : natH

            const rawBox = apiData.最优裁剪框 // [x, y, w, h] 原生像素坐标
            let cropBox: CropBox = DEFAULT_CROP

            if (boundaryW > 0 && boundaryH > 0 && rawBox.length === 4) {
              // 严格边界校验：x≥0, y≥0, x+w≤原图宽, y+h≤原图高
              let cx = Math.max(0, Math.round(rawBox[0]))
              let cy = Math.max(0, Math.round(rawBox[1]))
              let cw = Math.max(1, Math.round(rawBox[2]))
              let ch = Math.max(1, Math.round(rawBox[3]))

              // 超出边界自动向内修正，杜绝裁切框越界
              if (cx + cw > boundaryW) cw = boundaryW - cx
              if (cy + ch > boundaryH) ch = boundaryH - cy
              // 二次保险：宽度/高度不能超过原图尺寸
              if (cw > boundaryW) { cx = 0; cw = boundaryW }
              if (ch > boundaryH) { cy = 0; ch = boundaryH }

              cropBox = {
                x: cx / boundaryW,
                y: cy / boundaryH,
                w: cw / boundaryW,
                h: ch / boundaryH,
              }
            }

            // 主体点位锁定在裁剪框内部
            const subjectPt: SubjectPoint = {
              x: cropBox.x + cropBox.w * 0.5,
              y: cropBox.y + cropBox.h * 0.4,
            }

            const primaryComp = COMP_NAME_TO_KEY[apiData.构图类型] || 'thirds'
            const newAspectRatio = aspectRatioToNumber(apiData.推荐画幅)
            const rotation = clamp(apiData.推荐旋转角度, -10, 10)

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
              userRotation: rotation,
              aspectRatio: newAspectRatio,
              editorMode: 'ai',
            }))

            resolve()
          } catch (apiError) {
            // API 调用失败 → 设置错误状态，但图片仍然可用
            console.error('[useComposition] AI 分析失败:', apiError)
            setState(prev => ({
              ...prev,
              isAnalyzing: false,
              analysisError: 'AI分析失败，请重试',
            }))
            // 即使失败也 resolve，图片已加载
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

  /** 更新用户旋转 */
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
      // 重置新增状态
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
