"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface CropBox {
  x: number; y: number; w: number; h: number  // 比例 0-1，基于图片 naturalWidth/naturalHeight
}

interface SubjectPoint {
  x: number; y: number  // 比例 0-1，基于图片 naturalWidth/naturalHeight
}

interface ImageFrameProps {
  title: string
  imageSrc: string | null
  aspectRatio: number
  onImageChange?: (src: string) => void
  editable?: boolean
  highlight?: boolean
  showGuides?: boolean
  cropBox?: CropBox
  subjectPoint?: SubjectPoint
  cropColor?: string
  editorMode?: 'ai' | 'edit'
  userRotation?: number
  onCropBoxChange?: (box: CropBox) => void
  onSubjectPointChange?: (pt: SubjectPoint) => void
  onRotationChange?: (deg: number) => void
  className?: string
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
  className = 'flex-1',
}: ImageFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [imgDisplayRect, setImgDisplayRect] = useState({ left: 0, top: 0, width: 0, height: 0 })

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

  // 图片加载后计算其实际显示区域（object-contain 模式下图片不一定填满容器）
  useEffect(() => {
    if (!imageSrc || !imgRef.current) return
    const img = imgRef.current
    const updateDisplayRect = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      const imgRect = img.getBoundingClientRect()
      if (!containerRect || !imgRect) return
      setImgDisplayRect({
        left: imgRect.left - containerRect.left,
        top: imgRect.top - containerRect.top,
        width: imgRect.width,
        height: imgRect.height,
      })
    }
    // 延迟一帧确保布局完成
    requestAnimationFrame(updateDisplayRect)
    // 监听窗口大小变化
    window.addEventListener('resize', updateDisplayRect)
    return () => window.removeEventListener('resize', updateDisplayRect)
  }, [imageSrc, containerSize])

  // ---- 交互处理（基于图片实际显示区域） ----
  const [dragging, setDragging] = useState<'crop' | 'subject' | 'crop-corner' | null>(null)
  const [dragCorner, setDragCorner] = useState<number>(-1)

  const getPosFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = imgDisplayRect
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect || rect.width === 0 || rect.height === 0) return { x: 0.5, y: 0.5 }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    // 转换为相对图片显示区域的 0-1 比例（基于图片的真实像素范围）
    return {
      x: Math.max(0, Math.min(1, (clientX - containerRect.left - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - containerRect.top - rect.top) / rect.height)),
    }
  }, [imgDisplayRect])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!editable || editorMode !== 'edit') return
    const pos = getPosFromEvent(e)
    if (!cropBox || !subjectPoint) return

    const cornerSize = 0.04
    const corners = [
      { x: cropBox.x, y: cropBox.y },
      { x: cropBox.x + cropBox.w, y: cropBox.y },
      { x: cropBox.x, y: cropBox.y + cropBox.h },
      { x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h },
    ]
    for (let i = 0; i < corners.length; i++) {
      if (Math.abs(pos.x - corners[i].x) < cornerSize && Math.abs(pos.y - corners[i].y) < cornerSize) {
        setDragging('crop-corner')
        setDragCorner(i)
        return
      }
    }

    if (pos.x >= cropBox.x && pos.x <= cropBox.x + cropBox.w &&
        pos.y >= cropBox.y && pos.y <= cropBox.y + cropBox.h) {
      setDragging('crop')
      return
    }

    if (Math.sqrt((pos.x - subjectPoint.x) ** 2 + (pos.y - subjectPoint.y) ** 2) < 0.05) {
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
        case 0:
          newBox.w = newBox.x + newBox.w - cx
          newBox.h = newBox.y + newBox.h - cy
          newBox.x = cx; newBox.y = cy
          break
        case 1:
          newBox.w = cx - newBox.x
          newBox.h = newBox.y + newBox.h - cy
          newBox.y = cy
          break
        case 2:
          newBox.w = newBox.x + newBox.w - cx
          newBox.h = cy - newBox.y
          newBox.x = cx
          break
        case 3:
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

  // ---- 裁剪框样式（仅在图片加载后渲染，基于图片实际显示区域） ----
  const showImage = !!imageSrc
  const imgLeft = imgDisplayRect.left
  const imgTop = imgDisplayRect.top
  const imgW = imgDisplayRect.width || 1
  const imgH = imgDisplayRect.height || 1

  const cropBoxStyle = showImage && cropBox && imgW > 0 ? {
    left: `${((imgLeft + cropBox.x * imgW) / containerSize.w) * 100}%`,
    top: `${((imgTop + cropBox.y * imgH) / containerSize.h) * 100}%`,
    width: `${(cropBox.w * imgW / containerSize.w) * 100}%`,
    height: `${(cropBox.h * imgH / containerSize.h) * 100}%`,
  } : undefined

  const ptStyle = showImage && subjectPoint && imgW > 0 ? {
    left: `${((imgLeft + subjectPoint.x * imgW) / containerSize.w) * 100}%`,
    top: `${((imgTop + subjectPoint.y * imgH) / containerSize.h) * 100}%`,
  } : undefined

  // 图片缩放因子（容器内图片实际宽度 / 原图 naturalWidth），用于辅助线定位
  const imgScaleX = imgW / containerSize.w
  const imgScaleY = imgH / containerSize.h

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {/* 标题行 — 无图片时隐藏 */}
      {showImage && (
        <div className="flex items-center justify-between h-7 mb-2">
          <h3 className="text-sm font-semibold text-white/90 tracking-widest uppercase">
            {title}
          </h3>
        </div>
      )}

      {/* 图片容器 — 无背景、无边框、无圆角、完全透明，图片水平垂直居中 */}
      <div
        ref={containerRef}
        className={`relative flex-1 min-w-0 flex items-center justify-center overflow-hidden ${
          editorMode === 'edit' && editable ? "cursor-move" : ""
        }`}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* 仅在图片加载后渲染 */}
        {showImage && (
          <>
            <img
              ref={imgRef}
              src={imageSrc!}
              alt={title}
              className="select-none h-full w-auto"
              style={{
                rotate: userRotation ? `${userRotation}deg` : undefined,
              }}
              draggable={false}
            />

            {/* 辅助线层 */}
            {showGuides && (
              <div className="absolute inset-0 pointer-events-none opacity-60">
                {/* 辅助线基于图片显示区域定位 */}
                <div style={{
                  position: 'absolute',
                  left: `${imgLeft / containerSize.w * 100}%`,
                  top: `${imgTop / containerSize.h * 100}%`,
                  width: `${imgScaleX * 100}%`,
                  height: `${imgScaleY * 100}%`,
                }}>
                  {/* 三分法 */}
                  <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-white/75" style={{ boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} />
                  <div className="absolute top-0 bottom-0 left-2/3 w-0.5 bg-white/75" style={{ boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} />
                  <div className="absolute left-0 right-0 top-1/3 h-0.5 bg-white/75" style={{ boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} />
                  <div className="absolute left-0 right-0 top-2/3 h-0.5 bg-white/75" style={{ boxShadow: "0 0 10px rgba(255,255,255,0.8)" }} />
                  {/* 中心十字 */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/50 border-l border-dashed border-white/60" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-white/50 border-t border-dashed border-white/60" />
                  {/* 对角线 */}
                  <svg className="absolute inset-0 w-full h-full">
                    <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="8 4" />
                    <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="8 4" />
                  </svg>
                  {/* 交叉点 */}
                  {[[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]].map(([lx, ly], i) => (
                    <div key={i} className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2" style={{ left: `${lx*100}%`, top: `${ly*100}%` }}>
                      <div className="w-full h-full rounded-full border-2 border-white/90 bg-white/35" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 裁剪框 — 基于图片实际显示区域，严格不超出图片边界 */}
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
              <div className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={ptStyle}>
                <div className="w-full h-full rounded-full border-3 bg-white/60"
                  style={{ borderColor: cropColor, boxShadow: `0 0 12px ${cropColor}` }} />
                <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: cropColor }} />
              </div>
            )}
          </>
        )}

        {/* 无图片时：完全透明，不渲染任何占位内容 */}
      </div>

      {/* 旋转滑块 (编辑模式) */}
      {editable && editorMode === 'edit' && (
        <div className="flex items-center gap-2 px-1 mt-2">
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
