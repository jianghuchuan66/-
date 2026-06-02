"use client"

import { ScoreDisplay } from "./score-display"
import { COMP_LABEL, KOUJUE, TIPS, SCENE_LABELS, SCENE_CLASS, pick } from "@/lib/text-library"
import type { SceneInfo, Compositions, CompositionResult } from "@/lib/composition-engine"

interface AnalysisPanelProps {
  score: number
  analysis: {
    summary: string
    recommendation: {
      title: string
      description: string
      reason: string
      suggestion: string
    }
    alternative?: {
      title: string
      reason: string
    }
    tips: string[]
  }
  sceneInfo?: SceneInfo | null
  compositions?: Compositions | null
}

export function AnalysisPanel({ score, analysis, sceneInfo, compositions }: AnalysisPanelProps) {
  const hasData = !!sceneInfo

  // 检测到的构图类型标签
  const compositionTags = compositions
    ? Object.entries(compositions)
        .filter(([, c]) => (c as CompositionResult).detected)
        .sort((a, b) => (b[1] as CompositionResult).confidence - (a[1] as CompositionResult).confidence)
        .slice(0, 4)
        .map(([type, comp]) => {
          const c = comp as CompositionResult
          const tagClass = c.quality === 'great' ? 'g' : c.quality === 'good' ? 'w' : 'r'
          return { type, label: COMP_LABEL[type] || type, quality: c.quality, tagClass, confidence: c.confidence }
        })
    : []

  // 场景信息
  const sceneLabel = sceneInfo ? (SCENE_LABELS[sceneInfo.scene] || '📷 通用') : ''
  const sceneClass = sceneInfo ? (SCENE_CLASS[sceneInfo.scene] || 'unknown') : ''

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl border-2 border-white/10 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 评分区域 */}
        <div className="lg:col-span-1">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-3 tracking-wide">
            <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            构图分析报告
          </h2>
          <ScoreDisplay score={score} />

          {/* 场景标签 */}
          {hasData && sceneInfo && (
            <div className="mt-4">
              <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                sceneInfo.scene === 'portrait' ? 'bg-[#fce4ec] text-[#c62856]' :
                sceneInfo.scene === 'landscape' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
                sceneInfo.scene === 'arch' ? 'bg-[#e3f2fd] text-[#1565c0]' :
                sceneInfo.scene === 'still' ? 'bg-[#fff8e1] text-[#e65100]' :
                sceneInfo.scene === 'sky' ? 'bg-[#e0f7fa] text-[#00695c]' :
                sceneInfo.scene === 'street' ? 'bg-[#f3e5f5] text-[#7b1fa2]' :
                'bg-white/10 text-white/60'
              }`}>
                {sceneLabel}
              </span>
              <div className="mt-3 space-y-1.5 text-xs text-white/50">
                <div>· 同色区域: {(sceneInfo.solidRatio * 100).toFixed(0)}%</div>
                <div>· 画面复杂度: {(sceneInfo.edgeDensity * 100).toFixed(0)}%</div>
                <div>· 实体占比: {(sceneInfo.entityRatio * 100).toFixed(0)}%</div>
                <div>· 级别: {sceneInfo.isMinimal ? '极简/纯色' : '常规画面'}</div>
                <div>· 主体: {sceneInfo.hasSubject ? '有明确主体' : '无明确主体'}</div>
              </div>
            </div>
          )}
        </div>

        {/* 原图总评 + AI推荐 */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
              原图构图总评
            </h3>
            <p className="text-sm text-white/60 leading-relaxed pl-4 border-l-2 border-white/20">
              {analysis.summary}
            </p>
          </div>

          {/* 检测到的构图标签 */}
          {compositionTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {compositionTags.map((tag) => (
                <span key={tag.type} className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                  tag.tagClass === 'g' ? 'bg-[#e8f8ed] text-[#1e7b3c]' :
                  tag.tagClass === 'w' ? 'bg-[#fff7ed] text-[#c2410c]' :
                  'bg-[#fef2f2] text-[#b91c1c]'
                }`}>
                  {tag.label} · {Math.round(tag.confidence * 100)}%
                </span>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
              AI 主推荐：{analysis.recommendation.title}
            </h3>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-white/80 font-medium text-xs uppercase tracking-widest">口诀</span>
                <p className="text-sm text-white/60 mt-2">{analysis.recommendation.description}</p>
              </div>
              <div>
                <span className="text-white/80 font-medium text-xs uppercase tracking-widest">理由</span>
                <p className="text-sm text-white/60 mt-2">{analysis.recommendation.reason}</p>
              </div>
              <div>
                <span className="text-white/80 font-medium text-xs uppercase tracking-widest">裁剪建议</span>
                <p className="text-sm text-white/60 mt-2">{analysis.recommendation.suggestion}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 备选推荐 + 优化建议 */}
        <div className="lg:col-span-1 space-y-6">
          {analysis.alternative && (
            <div>
              <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                备选推荐：{analysis.alternative.title}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed pl-4 border-l-2 border-white/20">
                {analysis.alternative.reason}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
              AI 优化建议
            </h3>
            <ul className="space-y-3">
              {analysis.tips.map((tip, index) => (
                <li key={index} className="text-sm text-white/60 flex items-start gap-3">
                  <span className="text-white/30 font-mono text-xs mt-0.5">0{index + 1}</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
