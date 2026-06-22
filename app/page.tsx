"use client"

import { useRef, useCallback, useEffect } from "react"
import { Header } from "@/components/header"
import { ImageFrame } from "@/components/image-frame"
import { AnalysisPanel } from "@/components/analysis-panel"
import { ParticleBackground } from "@/components/particle-background"
import { ColorPickerPanel } from "@/components/color-picker-panel"
import { useComposition } from "@/hooks/use-composition"
import { useBackgroundColor } from "@/hooks/use-background-color"
import {
  KOUJUE, COMP_LABEL, TIPS,
  getCopy, getMinimalCopy,
} from "@/lib/text-library"
import type { CompositionResult } from "@/lib/composition-engine"

export default function CompositionAnalyzer() {
  const {
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
  } = useComposition()

  // ---- 取色换背景 ----
  const bgColor = useBackgroundColor()

  // 读取当前图片取色
  const handleExtractFromCurrent = useCallback(() => {
    if (state.originalSrc) {
      bgColor.extractFromImage(state.originalSrc)
    }
  }, [state.originalSrc, bgColor.extractFromImage])

  // ---- 上传图片后自动提取主色并换背景 ----
  const prevSrcRef = useRef(state.originalSrc)
  useEffect(() => {
    const prev = prevSrcRef.current
    prevSrcRef.current = state.originalSrc
    // 每次上传新图片（originalSrc 变化且非空）自动取色换背景
    if (state.originalSrc && state.originalSrc !== prev) {
      bgColor.extractAndApply(state.originalSrc)
    }
  }, [state.originalSrc, bgColor.extractAndApply])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- 按钮处理 ----
  const handleUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadAndAnalyze(file).catch(err => console.error('分析失败:', err))
    }
    // 重置 input 以允许重复选同一文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [loadAndAnalyze])

  const handleSave = useCallback(() => {
    // 根据当前裁剪框截取原图对应像素区域，不包含任何背景色
    const cropBox = state.editorMode === 'edit' ? state.userCropBox : state.aiCropBox
    const src = state.originalSrc
    if (!src) return

    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const natW = img.naturalWidth
      const natH = img.naturalHeight

      // 裁剪框像素坐标（永远不超出原图边界）
      const sx = Math.max(0, Math.round(cropBox.x * natW))
      const sy = Math.max(0, Math.round(cropBox.y * natH))
      const sw = Math.min(natW - sx, Math.max(1, Math.round(cropBox.w * natW)))
      const sh = Math.min(natH - sy, Math.max(1, Math.round(cropBox.h * natH)))

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')!
      // 仅截取裁剪框内的像素区域，不包含任何背景色/空白
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      const link = document.createElement('a')
      link.download = 'composition_result.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = src
  }, [state.editorMode, state.originalSrc, state.aiCropBox, state.userCropBox])

  // ---- 构建分析数据供 AnalysisPanel 使用 ----
  const buildAnalysisData = useCallback(() => {
    // ---- 优先使用 AI API 返回的数据 ----
    if (state.apiData) {
      const api = state.apiData
      const quality = state.primaryQuality

      const summary = api.构图报告
        || `AI 识别为【${api.主体类型}】类照片，主推荐【${api.构图类型}】，综合评分 ${api.构图评分} 分。`

      const recommendation = {
        title: api.构图类型,
        description: KOUJUE[state.primaryComp] || '',
        // 理由：显示后端返回的「理由」字段（原样）
        reason: api.理由 || '',
        // 裁剪方案：显示后端返回的「裁剪方案」字段（原样）
        suggestion: api.裁剪方案 || '',
      }

      // AI优化建议：显示后端返回的「AI优化建议」字段，按分号拆分为分点
      const tips = api.AI优化建议
        ? api.AI优化建议.split(/[；;]/).filter(Boolean).map(s => s.trim())
        : []

      return { summary, recommendation, alternative: undefined as { title: string; reason: string } | undefined, tips }
    }

    // ---- 无 API 数据时使用原有逻辑 ----
    if (!state.analysis) {
      return {
        summary: "",
        recommendation: { title: "", description: "", reason: "", suggestion: "" },
        alternative: undefined as { title: string; reason: string } | undefined,
        tips: [] as string[],
      }
    }

    const { sceneInfo, compositions, primaryComp, backupComp, primaryQuality } = state

    // 总评文案
    let summary = ""
    if (sceneInfo && sceneInfo.isMinimal && !sceneInfo.hasSubject) {
      summary = getMinimalCopy('summary')
    } else {
      summary = getCopy(primaryComp, primaryQuality)
      if (!summary) summary = "画面中检测到多种构图特征，综合表现良好。"
    }

    // AI主推荐
    const recComp = compositions?.[primaryComp as keyof typeof compositions] as CompositionResult | undefined
    const recommendation = {
      title: COMP_LABEL[primaryComp] || primaryComp,
      description: KOUJUE[primaryComp] || "",
      reason: recComp
        ? `${COMP_LABEL[primaryComp]}置信度 ${Math.round(recComp.confidence * 100)}%，检测质量：${primaryQuality === 'great' ? '优秀' : primaryQuality === 'good' ? '良好' : '待改进'}`
        : "根据画面特征自动匹配最佳构图",
      suggestion: primaryQuality === 'great'
        ? "构图运用优秀，保持当前方案即可"
        : primaryQuality === 'good'
          ? "微调主体位置可进一步提升"
          : "建议按推荐方向调整构图",
    }

    // 备选推荐
    const alternative = backupComp && backupComp !== primaryComp ? {
      title: COMP_LABEL[backupComp] || backupComp,
      reason: KOUJUE[backupComp] || "",
    } : undefined

    // 优化建议
    const tips = TIPS[primaryComp] || TIPS['thirds']

    return { summary, recommendation, alternative, tips }
  }, [state.apiData, state.analysis, state.primaryComp, state.backupComp, state.primaryQuality])

  const analysisData = buildAnalysisData()

  // ---- 图片源 ----
  const hasImage = !!state.originalSrc
  const imageSrc = state.originalSrc || ""

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden bg-[#080808]"
      style={
        bgColor.hasApplied && bgColor.displayColor
          ? {
              backgroundColor: `rgb(${bgColor.displayColor.r},${bgColor.displayColor.g},${bgColor.displayColor.b})`,
              transition: 'background-color 0.6s ease',
            }
          : { transition: 'background-color 0.6s ease' }
      }
    >
      {/* 3D 粒子背景 */}
      <ParticleBackground
        customBgColor={
          bgColor.hasApplied && bgColor.displayColor
            ? { r: bgColor.displayColor.r, g: bgColor.displayColor.g, b: bgColor.displayColor.b }
            : null
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          onUpload={handleUpload}
          onApplyAI={applyAI}
          onSave={handleSave}
          onReset={reset}
          hasImage={hasImage}
        />

        {/* ========== AI 分析加载层 ========== */}
        {state.isAnalyzing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
              {/* 旋转动画 */}
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white text-base font-medium tracking-wider">
                AI构图分析中…
              </span>
              <span className="text-white/50 text-xs">正在通过 AI 视觉模型分析画面</span>
            </div>
          </div>
        )}

        {/* ========== AI 分析错误提示 ========== */}
        {state.analysisError && !state.isAnalyzing && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm backdrop-blur-md shadow-lg">
            ⚠️ {state.analysisError}
            <button
              onClick={() => {
                // 清除错误，允许用户重新上传
                const fileInput = fileInputRef.current
                if (fileInput) fileInput.click()
              }}
              className="ml-3 underline hover:text-red-200 transition-colors"
            >
              重新上传
            </button>
          </div>
        )}

        <main className="flex-1 flex flex-col p-4 lg:p-6">
          <div className="w-[90%] mx-auto flex flex-col gap-6">
            {/* ===== 上方：AI 推荐构图（独立展示，宽度自适应） ===== */}
            <div className="flex justify-center" style={{ height: 'min(45vh, 520px)' }}>
              <ImageFrame
                title="AI 推荐构图"
                imageSrc={state.aiPreviewSrc || imageSrc}
                aspectRatio={state.aspectRatio || 4/3}
                showGuides={state.showGuides}
                className="h-full"
              />
            </div>

            {/* ===== 下方：原图 + 用户定制版（水平并排，与上方等高） ===== */}
            <div className="flex items-stretch justify-center" style={{ gap: '24px', height: 'min(45vh, 520px)' }}>
              <ImageFrame
                title="原图"
                imageSrc={imageSrc}
                aspectRatio={state.aspectRatio || 4/3}
                showGuides={state.showGuides}
                className=""
              />

              <ImageFrame
                title="用户定制版"
                imageSrc={state.customPreviewSrc || imageSrc}
                aspectRatio={state.aspectRatio || 4/3}
                editable
                showGuides={state.showGuides}
                className=""
                cropBox={hasImage ? (state.editorMode === 'edit' ? state.userCropBox : state.aiCropBox) : undefined}
                subjectPoint={hasImage ? (state.editorMode === 'edit' ? state.userSubjectPoint : state.aiSubjectPoint) : undefined}
                cropColor={state.editorMode === 'edit' ? "rgba(249,115,22,0.7)" : "rgba(34,197,94,0.55)"}
                editorMode={state.editorMode}
                userRotation={state.userRotation}
                onCropBoxChange={updateUserCropBox}
                onSubjectPointChange={updateUserSubjectPoint}
                onRotationChange={updateUserRotation}
              />
            </div>

            {/* 构图辅助线图例 */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-white/50 py-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-0.5 bg-white/50 shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
                <span>三分线</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-px border-t border-dashed border-white/40" />
                <span>中心轴</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-px bg-white/25 border-t border-dashed" />
                <span>对角线</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white/70 bg-white/20" />
                <span>黄金点</span>
              </div>
              {hasImage && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-[#22c55e]/60" />
                    <span>AI裁剪框</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-[#f97316]/60" />
                    <span>用户编辑框</span>
                  </div>
                </>
              )}
            </div>

            {/* 快速操作按钮行 */}
            {hasImage && (
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button
                  onClick={applyAI}
                  className="px-5 py-2 rounded-lg bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#22c55e] text-sm font-medium hover:bg-[#22c55e]/30 transition-all"
                >
                  🤖 应用 AI 推荐
                </button>
                <button
                  onClick={enterEditMode}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    state.editorMode === 'edit'
                      ? 'bg-[#f97316]/20 border border-[#f97316]/40 text-[#f97316]'
                      : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/20'
                  }`}
                >
                  ✏️ {state.editorMode === 'edit' ? '编辑模式 (已激活)' : '进入编辑模式'}
                </button>
                <button
                  onClick={confirmEdit}
                  className="px-5 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 text-sm font-medium hover:bg-white/20 transition-all"
                >
                  ✅ 确认个性化修改
                </button>
                <button
                  onClick={toggleGuides}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    state.showGuides
                      ? 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/20'
                      : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  👁️ {state.showGuides ? '隐藏辅助线' : '显示辅助线'}
                </button>
              </div>
            )}

            {/* AI 分析信息条 */}
            {state.apiData && (
              <div className="flex items-center justify-center gap-6 text-xs text-white/60 bg-white/5 rounded-lg py-2 px-4 border border-white/10">
                <span>🎯 主体类型：<b className="text-white/80">{state.apiData.主体类型}</b></span>
                <span>🖼️ 推荐画幅：<b className="text-white/80">{state.apiData.推荐画幅}</b></span>
                <span>✂️ 裁剪：<b className="text-white/80">左{state.apiData.左裁百分比}% 右{state.apiData.右裁百分比}% 上{state.apiData.上裁百分比}% 下{state.apiData.下裁百分比}%</b></span>
              </div>
            )}

            {/* 分析面板 */}
            <AnalysisPanel
              score={hasImage ? state.score : 0}
              analysis={analysisData}
              sceneInfo={hasImage ? state.sceneInfo : undefined}
              compositions={hasImage ? state.compositions : undefined}
            />
          </div>
        </main>
      </div>

      {/* ========== 取色换背景面板 ========== */}
      <ColorPickerPanel
        isOpen={bgColor.isPanelOpen}
        onToggle={() => bgColor.setIsPanelOpen(!bgColor.isPanelOpen)}
        extractedColor={bgColor.extractedColor}
        displayColor={bgColor.displayColor}
        displayHex={bgColor.displayHex}
        displayRgb={bgColor.displayRgb}
        textColor={bgColor.textColor}
        saturation={bgColor.saturation}
        onSaturationChange={bgColor.setSaturation}
        isExtracting={bgColor.isExtracting}
        hasApplied={bgColor.hasApplied}
        onExtractFromCurrent={handleExtractFromCurrent}
        onApply={bgColor.applyBackground}
        onRemove={bgColor.removeBackground}
      />
    </div>
  )
}
