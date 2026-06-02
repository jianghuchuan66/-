"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"

interface CropBox {
  x: number; y: number; w: number; h: number  // 比例 0-1
}

interface SubjectPoint {
  x: number; y: number  // 比例 0-1
}

interface ImageFrameProps {
  title: string
  imageSrc: string | null
  aspectRatio: number
  onImageChange?: (src: string) => void
  editable?: boolean
  highlight?: boolean
  showGuides?: boolean
  /** AI推荐/用户编辑的裁剪框 */
  cropBox?: CropBox
  /** AI推荐/用户编辑的主体点位 */
  subjectPoint?: SubjectPoint
  /** 裁剪框颜色 */
  cropColor?: string
  /** 编辑模式 */
  editorMode?: 'ai' | 'edit'
  /** 用户旋转角度 */
  userRotation?: number
  /** 裁剪框变更回调 */
  onCropBoxChange?: (box: CropBox) => void
  /** 主体点位变更回调 */
  onSubjectPointChange?: (pt: SubjectPoint) => void
  /** 旋转变更回调 */
  onRotationChange?: (deg: number) => void
}

export function ImageFrame({
  title,
  imageSrc,
  aspectRatio,
  editable = false,
  highlight = false,
  showGuides = true,
  cropBox,
  subjectPoint,
  cropColor = "rgba(34,197,94,0.55)",
  editorMode = 'ai',
  userRotation = 0,
  onCropBoxChange,
  onSubjectPointChange,
  onRotationChange,
}: ImageFrameProps) {
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // 监听容器大小
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ w: width, h: height })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ---- 交互处理 ----
  const [dragging, setDragging] = useState<'crop' | 'subject' | 'crop-corner' | null>(null)
  const [dragCorner, setDragCorner] = useState<number>(-1) // 0=左上,1=右上,2=左下,3=右下

  const getPosFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }, [])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!editable || editorMode !== 'edit') return
    const pos = getPosFromEvent(e)
    if (!cropBox || !subjectPoint) return

    // 检查是否在裁剪框角上
    const cornerSize = 0.04
    const corners = [
      { x: cropBox.x, y: cropBox.y },                      // 左上
      { x: cropBox.x + cropBox.w, y: cropBox.y },           // 右上
      { x: cropBox.x, y: cropBox.y + cropBox.h },           // 左下
      { x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h }, // 右下
    ]
    for (let i = 0; i < corners.length; i++) {
      const dx = Math.abs(pos.x - corners[i].x)
      const dy = Math.abs(pos.y - corners[i].y)
      if (dx < cornerSize && dy < cornerSize) {
        setDragging('crop-corner')
        setDragCorner(i)
        return
      }
    }

    // 检查是否在裁剪框内
    if (
      pos.x >= cropBox.x && pos.x <= cropBox.x + cropBox.w &&
      pos.y >= cropBox.y && pos.y <= cropBox.y + cropBox.h
    ) {
      setDragging('crop')
      return
    }

    // 检查是否在主体点附近
    const ptDist = Math.sqrt((pos.x - subjectPoint.x) ** 2 + (pos.y - subjectPoint.y) ** 2)
    if (ptDist < 0.05) {
      setDragging('subject')
      return
    }
  }, [editable, editorMode, cropBox, subjectPoint, getPosFromEvent])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !cropBox) return
    const pos = getPosFromEvent(e)
    const clampPos = (v: number) => Math.max(0, Math.min(1, v))

    if (dragging === 'crop') {
      const newX = clampPos(pos.x - cropBox.w / 2)
      const newY = clampPos(pos.y - cropBox.h / 2)
      onCropBoxChange?.({
        x: newX,
        y: newY,
        w: Math.min(cropBox.w, 1 - newX),
        h: Math.min(cropBox.h, 1 - newY),
      })
    } else if (dragging === 'crop-corner') {
      const newBox = { ...cropBox }
      const cx = clampPos(pos.x), cy = clampPos(pos.y)
      switch (dragCorner) {
        case 0: // 左上
          newBox.w = newBox.x + newBox.w - cx
          newBox.h = newBox.y + newBox.h - cy
          newBox.x = cx
          newBox.y = cy
          break
        case 1: // 右上
          newBox.w = cx - newBox.x
          newBox.h = newBox.y + newBox.h - cy
          newBox.y = cy
          break
        case 2: // 左下
          newBox.w = newBox.x + newBox.w - cx
          newBox.h = cy - newBox.y
          newBox.x = cx
          break
        case 3: // 右下
          newBox.w = cx - newBox.x
          newBox.h = cy - newBox.y
          break
      }
      newBox.w = Math.max(0.1, Math.min(1 - newBox.x, newBox.w))
      newBox.h = Math.max(0.1, Math.min(1 - newBox.y, newBox.h))
      onCropBoxChange?.(newBox)
    } else if (dragging === 'subject') {
      onSubjectPointChange?.({ x: clampPos(pos.x), y: clampPos(pos.y) })
    }
  }, [dragging, dragCorner, cropBox, getPosFromEvent, onCropBoxChange, onSubjectPointChange])

  const handlePointerUp = useCallback(() => {
    setDragging(null)
    setDragCorner(-1)
  }, [])

  // ---- 渲染裁剪框样式 ----
  const cropBoxStyle = cropBox && containerSize.w > 0 ? {
    left: `${cropBox.x * 100}%`,
    top: `${cropBox.y * 100}%`,
    width: `${cropBox.w * 100}%`,
    height: `${cropBox.h * 100}%`,
  } : undefined

  // ---- 渲染主体点样式 ----
  const ptStyle = subjectPoint && containerSize.w > 0 ? {
    left: `${subjectPoint.x * 100}%`,
    top: `${subjectPoint.y * 100}%`,
  } : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90 tracking-widest uppercase flex items-center gap-3">
          {highlight && <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />}
          {title}
        </h3>
        {editable && (
          <span className={`text-xs px-3 py-1 rounded-full border transition-all ${
            editorMode === 'edit'
              ? 'bg-[#f97316]/20 border-[#f97316]/40 text-[#f97316]'
              : 'bg-white/10 border-white/20 text-white/60'
          }`}>
            {editorMode === 'edit' ? '正在编辑' : '可编辑'}
          </span>
        )}
      </div>
      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden rounded-xl border-2 bg-black/40 backdrop-blur-md transition-all duration-300 ${
          highlight ? "border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.15)]" : "border-white/20"
        } ${isHovered ? "border-white/60 shadow-[0_0_40px_rgba(255,255,255,0.2)]" : ""} ${
          editorMode === 'edit' && editable ? "cursor-move" : ""
        }`}
        style={{ aspectRatio: aspectRatio }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); handlePointerUp() }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {imageSrc ? (
          <>
            <Image
              src={imageSrc}
              alt={title}
              fill
              className="object-contain transition-transform duration-500"
              style={{
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                rotate: userRotation ? `${userRotation}deg` : undefined,
              }}
            />

            {/* 辅助线层 */}
            {showGuides && (
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-60"}`}>
                {/* 三分法 */}
                <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-white/50" style={{ boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                <div className="absolute top-0 bottom-0 left-2/3 w-0.5 bg-white/50" style={{ boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                <div className="absolute left-0 right-0 top-1/3 h-0.5 bg-white/50" style={{ boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                <div className="absolute left-0 right-0 top-2/3 h-0.5 bg-white/50" style={{ boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                {/* 中心十字 */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30 border-l border-dashed border-white/40" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30 border-t border-dashed border-white/40" />
                {/* 对角线 */}
                <svg className="absolute inset-0 w-full h-full">
                  <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="8 4" />
                  <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="8 4" />
                </svg>
                {/* 交叉点 */}
                {[[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]].map(([lx, ly], i) => (
                  <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2" style={{ left: `${lx*100}%`, top: `${ly*100}%` }}>
                    <div className="w-full h-full rounded-full border-2 border-white/70 bg-white/20" />
                  </div>
                ))}
              </div>
            )}

            {/* 裁剪框 */}
            {cropBoxStyle && (
              <div
                className="absolute pointer-events-none border-2 border-dashed"
                style={{
                  ...cropBoxStyle,
                  borderColor: cropColor,
                  backgroundColor: cropColor?.replace(/[\d.]+\)$/, '0.08)'),
                  boxShadow: `0 0 12px ${cropColor}`,
                }}
              >
                {/* 四角手柄 */}
                {editable && editorMode === 'edit' && (
                  <>
                    {[[0,0],[1,0],[0,1],[1,1]].map(([cx, cy], i) => (
                      <div
                        key={i}
                        className="absolute w-4 h-4 rounded-full border-2 bg-white/80 pointer-events-auto"
                        style={{
                          left: cx === 0 ? '-8px' : undefined,
                          right: cx === 1 ? '-8px' : undefined,
                          top: cy === 0 ? '-8px' : undefined,
                          bottom: cy === 1 ? '-8px' : undefined,
                          borderColor: cropColor,
                          cursor: i === 0 ? 'nw-resize' : i === 1 ? 'ne-resize' : i === 2 ? 'sw-resize' : 'se-resize',
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* 主体点位 */}
            {ptStyle && (
              <div
                className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={ptStyle}
              >
                <div
                  className="w-full h-full rounded-full border-3 bg-white/60"
                  style={{
                    borderColor: cropColor,
                    boxShadow: `0 0 12px ${cropColor}`,
                  }}
                />
                <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: cropColor }} />
              </div>
            )}

            {/* 底部标签 */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
              <span className="text-xs text-white/80 font-medium tracking-wide">{title}</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <svg className="w-16 h-16 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">暂无图片</span>
          </div>
        )}
      </div>

      {/* 旋转滑块 (编辑模式) */}
      {editable && editorMode === 'edit' && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-white/50">旋转:</span>
          <input
            type="range"
            min="-10"
            max="10"
            step="0.5"
            value={userRotation || 0}
            onChange={(e) => onRotationChange?.(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-white/20 cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-xs text-white/50 w-10 text-right">{userRotation || 0}°</span>
        </div>
      )}
    </div>
  )
}
