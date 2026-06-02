// ===================================================================
//  构图分析引擎 — 画面分类 + 12种构图检测 + AI推荐 + 评分
//  纯 TypeScript，无 DOM 依赖，可在 Web Worker 中运行
// ===================================================================

// ---- 类型定义 ----

export interface SceneInfo {
  scene: 'portrait' | 'landscape' | 'arch' | 'still' | 'sky' | 'street' | 'unknown'
  isMinimal: boolean
  hasSubject: boolean
  solidRatio: number       // 同色区域占比 0-1
  complexity: number       // 画面复杂度 0-1
  avgBrightness: number
  brightnessStd: number
  edgeDensity: number
  entityRatio: number      // 实体占比 0-1
  flatRatio: number        // 平坦区域占比 0-1
  dominantHue: string
}

export interface CompositionResult {
  detected: boolean
  confidence: number       // 0-1
  quality: 'great' | 'good' | 'issue'
  data: Record<string, unknown>
}

export interface Compositions {
  symmetry: CompositionResult
  contrast: CompositionResult
  leading: CompositionResult
  frame: CompositionResult
  layering: CompositionResult
  point: CompositionResult
  thirds: CompositionResult
  repeat: CompositionResult
  dynamic: CompositionResult
  center: CompositionResult
  whitespace: CompositionResult
  geometry: CompositionResult
  hvline: CompositionResult
}

export interface AnalysisResult {
  sceneInfo: SceneInfo
  compositions: Compositions
  score: number
  primaryComp: string
  backupComp: string
  primaryQuality: 'great' | 'good' | 'issue'
}

// ---- 工具函数 ----

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

// ===================================================================
//  Module A: 场景分类器
// ===================================================================

export function classifyScene(
  pixels: Uint8ClampedArray, w: number, h: number
): SceneInfo {
  const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 80))
  const brightnesses: number[] = []
  const hues: number[] = []
  let totalBrightness = 0
  const BLOCK = 64 // 256/4 per channel → 4³ = 64 bins
  const colorHisto: Record<string, number> = {}

  for (let y = 0; y < h; y += sampleStep) {
    for (let x = 0; x < w; x += sampleStep) {
      const idx = (y * w + x) * 4
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]
      const l = luminance(r, g, b)
      brightnesses.push(l)
      totalBrightness += l

      const qr = Math.floor(r / BLOCK), qg = Math.floor(g / BLOCK), qb = Math.floor(b / BLOCK)
      const key = `${qr},${qg},${qb}`
      colorHisto[key] = (colorHisto[key] || 0) + 1

      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
      if (maxC - minC > 20) {
        let hue = 0
        if (maxC === r) hue = ((g - b) / (maxC - minC)) * 60
        else if (maxC === g) hue = ((b - r) / (maxC - minC)) * 60 + 120
        else hue = ((r - g) / (maxC - minC)) * 60 + 240
        if (hue < 0) hue += 360
        hues.push(hue)
      }
    }
  }

  const sampleCount = brightnesses.length
  const avgBrightness = totalBrightness / sampleCount
  const brightnessStd = Math.sqrt(
    brightnesses.reduce((s, v) => s + (v - avgBrightness) ** 2, 0) / sampleCount
  )

  // 纯色占比
  const maxColorCount = Math.max(...Object.values(colorHisto), 0)
  const solidRatio = maxColorCount / sampleCount

  const threshold = sampleCount * 0.05
  const majorClusters = Object.entries(colorHisto)
    .filter(([, cnt]) => cnt >= threshold)
    .sort((a, b) => b[1] - a[1])
  const top3Count = majorClusters.slice(0, 3).reduce((s, [, c]) => s + c, 0)
  const top3Ratio = top3Count / sampleCount

  // 边缘密度
  const edgeDensity = calcEdgeDensity(pixels, w, h, sampleStep)

  // 实体占比（平坦区域检测）
  const blockSize = Math.floor(Math.min(w, h) / 15)
  let flatBlocks = 0, totalBlocks = 0
  for (let by = 0; by + blockSize < h; by += blockSize) {
    for (let bx = 0; bx + blockSize < w; bx += blockSize) {
      const vals: number[] = []
      for (let dy = 0; dy < blockSize; dy += sampleStep * 2) {
        for (let dx = 0; dx < blockSize; dx += sampleStep * 2) {
          const idx = ((by + dy) * w + (bx + dx)) * 4
          vals.push(luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2]))
        }
      }
      if (vals.length < 4) continue
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const v = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length
      if (v < 150) flatBlocks++
      totalBlocks++
    }
  }
  const flatRatio = totalBlocks > 0 ? flatBlocks / totalBlocks : 0
  const entityRatio = totalBlocks > 0 ? 1 - flatRatio : 0.5

  // 判定极简
  const isSolidColor = top3Ratio >= 0.70
  const isLowVariance = brightnessStd < 30
  const isVeryFlat = flatRatio > 0.70
  const isMinimal = isSolidColor || isLowVariance || isVeryFlat
  const hasSubject = !isMinimal || edgeDensity > 0.08

  // 场景分类
  let scene: SceneInfo['scene'] = 'unknown'
  if (isMinimal && !hasSubject) {
    scene = 'sky'
  } else if (edgeDensity > 0.25) {
    scene = avgBrightness < 100 ? 'street' : 'arch'
  } else if (avgBrightness > 180 && brightnessStd < 50) {
    scene = 'sky'
  } else if (edgeDensity > 0.15 && brightnessStd > 45) {
    const avgHue = hues.length > 0 ? hues.reduce((a, b) => a + b, 0) / hues.length : 0
    scene = (avgHue > 20 && avgHue < 160) ? 'landscape' : 'street'
  } else if (edgeDensity < 0.12 && !isMinimal) {
    scene = 'still'
  } else {
    scene = 'landscape'
  }
  if (entityRatio > 0.6 && edgeDensity > 0.2) scene = 'arch'
  if (avgBrightness < 90 && edgeDensity > 0.18) scene = 'street'

  return {
    scene, isMinimal, hasSubject,
    solidRatio: parseFloat(solidRatio.toFixed(2)),
    complexity: parseFloat(edgeDensity.toFixed(3)),
    avgBrightness: parseFloat(avgBrightness.toFixed(1)),
    brightnessStd: parseFloat(brightnessStd.toFixed(1)),
    edgeDensity: parseFloat(edgeDensity.toFixed(3)),
    entityRatio: parseFloat(entityRatio.toFixed(2)),
    flatRatio: parseFloat(flatRatio.toFixed(2)),
    dominantHue: '',
  }
}

function calcEdgeDensity(
  pixels: Uint8ClampedArray, w: number, h: number, step: number
): number {
  const st = Math.max(1, step)
  let edgeCount = 0, total = 0
  for (let y = st; y < h - st; y += st) {
    for (let x = st; x < w - st; x += st) {
      const get = (ox: number, oy: number) => {
        const i = ((y + oy * st) * w + (x + ox * st)) * 4
        return luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      }
      const gx = get(1, 0) - get(-1, 0)
      const gy = get(0, 1) - get(0, -1)
      if (Math.abs(gx) + Math.abs(gy) > 30) edgeCount++
      total++
    }
  }
  return total > 0 ? edgeCount / total : 0
}

// ===================================================================
//  Module B: 12种构图检测器
// ===================================================================

/** 1. 对称构图 */
function detectSymmetry(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const midX = Math.floor(w / 2)
  const band = Math.floor(w * 0.2)
  const step = 4
  let leftEdge = 0, rightEdge = 0
  for (let y = 0; y < h; y += step) {
    for (let x = step; x < w; x += step) {
      const idx = (y * w + x) * 4
      const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
      const prevIdx = (y * w + (x - step)) * 4
      const prev = luminance(pixels[prevIdx], pixels[prevIdx + 1], pixels[prevIdx + 2])
      const edge = Math.abs(l - prev)
      if (x < midX - band) leftEdge += edge
      else if (x > midX + band) rightEdge += edge
    }
  }
  const symScore = leftEdge > 0 ? 1 - Math.abs(leftEdge - rightEdge) / Math.max(leftEdge, rightEdge) : 0
  const score = clamp(symScore, 0, 1)
  return {
    detected: score > 0.4,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.7 ? 'great' : score > 0.4 ? 'good' : 'issue',
    data: { symScore: score },
  }
}

/** 2. 对比构图 (基于亮度/颜色反差) */
function detectContrast(
  pixels: Uint8ClampedArray, sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  // 亮度标准差高 → 对比强
  const score = clamp(sceneInfo.brightnessStd / 128, 0, 1)
  return {
    detected: score > 0.35,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.6 ? 'great' : score > 0.35 ? 'good' : 'issue',
    data: { brightnessStd: sceneInfo.brightnessStd },
  }
}

/** 3. 引导线构图 */
function detectLeading(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const step = Math.max(3, Math.floor(Math.min(w, h) / 80))
  const lines: Array<{ x: number; y: number; angle: number; mag: number }> = []
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const get = (ox: number, oy: number) => {
        const i = ((y + oy * step) * w + (x + ox * step)) * 4
        return luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      }
      const gx = get(1, 0) - get(-1, 0)
      const gy = get(0, 1) - get(0, -1)
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 40) lines.push({ x, y, angle: Math.atan2(gy, gx), mag })
    }
  }
  if (lines.length < 30) {
    return { detected: false, confidence: 0, quality: 'issue', data: { lineCount: lines.length } }
  }
  const cx = w / 2, cy = h * 0.6
  let converging = 0
  for (const line of lines) {
    const toVP = Math.atan2(cy - line.y, cx - line.x)
    const diff = Math.abs(line.angle - toVP)
    const normDiff = Math.min(diff, Math.PI * 2 - diff)
    if (normDiff < Math.PI / 4 || normDiff > Math.PI * 3 / 4) converging++
  }
  const ratio = converging / lines.length
  return {
    detected: ratio > 0.18,
    confidence: parseFloat(ratio.toFixed(2)),
    quality: ratio > 0.35 ? 'great' : ratio > 0.2 ? 'good' : 'issue',
    data: { vanishingPoint: { x: cx, y: cy }, lineCount: lines.length, convergingRatio: ratio },
  }
}

/** 4. 框架式构图 */
function detectFrame(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const margin = Math.floor(Math.min(w, h) * 0.12)
  const step = 4
  let edgeEdges = 0, centerEdges = 0, edgeTotal = 0, centerTotal = 0
  for (let y = 0; y < h; y += step) {
    for (let x = step; x < w; x += step) {
      const idx = (y * w + x) * 4
      const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
      const prevIdx = (y * w + (x - step)) * 4
      const prev = luminance(pixels[prevIdx], pixels[prevIdx + 1], pixels[prevIdx + 2])
      const edge = Math.abs(l - prev)
      const isEdgeZone = x < margin || x > w - margin || y < margin || y > h - margin
      if (isEdgeZone) { if (edge > 25) edgeEdges++; edgeTotal++ }
      else { if (edge > 25) centerEdges++; centerTotal++ }
    }
  }
  const edgeDensityEdge = edgeTotal > 0 ? edgeEdges / edgeTotal : 0
  const edgeDensityCenter = centerTotal > 0 ? centerEdges / centerTotal : 0
  const frameScore = edgeDensityEdge - edgeDensityCenter
  return {
    detected: frameScore > 0.02,
    confidence: parseFloat(clamp(frameScore * 5, 0, 1).toFixed(2)),
    quality: frameScore > 0.08 ? 'great' : frameScore > 0.03 ? 'good' : 'issue',
    data: { edgeDensityEdge, edgeDensityCenter, frameScore },
  }
}

/** 5. 分层构图 (基于横向带状边缘密度变化) */
function detectLayering(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const bands = 6
  const bandH = Math.floor(h / bands)
  const step = 4
  const bandEdgeDensity: number[] = []
  for (let b = 0; b < bands; b++) {
    let edges = 0, total = 0
    const y0 = b * bandH, y1 = Math.min(y0 + bandH, h)
    for (let y = y0 + step; y < y1; y += step) {
      for (let x = step; x < w; x += step) {
        const idx = (y * w + x) * 4
        const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
        const prevIdx = (y * w + (x - step)) * 4
        const prev = luminance(pixels[prevIdx], pixels[prevIdx + 1], pixels[prevIdx + 2])
        if (Math.abs(l - prev) > 25) edges++
        total++
      }
    }
    bandEdgeDensity.push(total > 0 ? edges / total : 0)
  }
  // 层间密度变化大 → 分层明显
  const mean = bandEdgeDensity.reduce((a, b) => a + b, 0) / bands
  const variance = bandEdgeDensity.reduce((s, v) => s + (v - mean) ** 2, 0) / bands
  const score = clamp(variance * 20, 0, 1)
  return {
    detected: score > 0.25,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.5 ? 'great' : score > 0.3 ? 'good' : 'issue',
    data: { bandEdgeDensity, layerVariance: variance },
  }
}

/** 6. 点构图 (主体小且孤立) */
function detectPoint(
  _pixels: Uint8ClampedArray, sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  // 边缘密度低 + 有主体 → 点构图特征
  const score = sceneInfo.edgeDensity < 0.15 && sceneInfo.hasSubject
    ? clamp(1 - sceneInfo.edgeDensity * 5, 0, 1)
    : clamp(sceneInfo.edgeDensity * 2, 0, 1) * 0.3
  return {
    detected: score > 0.4,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.7 ? 'great' : score > 0.4 ? 'good' : 'issue',
    data: {},
  }
}

/** 7. 三分构图 */
function detectThirds(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const grid = 5
  const cellW = Math.floor(w / grid), cellH = Math.floor(h / grid)
  let maxW = 0, maxR = 2, maxC = 2
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      let contrast = 0, cnt = 0
      const x0 = c * cellW, y0 = r * cellH
      const x1 = Math.min(x0 + cellW, w), y1 = Math.min(y0 + cellH, h)
      let prev: number | null = null
      for (let py = y0; py < y1; py += 2) {
        for (let px = x0; px < x1; px += 2) {
          const idx = (py * w + px) * 4
          const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
          cnt++
          if (prev !== null) contrast += Math.abs(l - prev)
          prev = l
        }
      }
      const wt = contrast / Math.max(cnt, 1)
      if (wt > maxW) { maxW = wt; maxR = r; maxC = c }
    }
  }
  const normX = (maxC + 0.5) / grid, normY = (maxR + 0.5) / grid
  const thirdPts: [number, number][] = [[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]]
  let minDist = Infinity, nearestPt: [number, number] | null = null
  for (const [tx, ty] of thirdPts) {
    const d = Math.sqrt((normX - tx) ** 2 + (normY - ty) ** 2)
    if (d < minDist) { minDist = d; nearestPt = [tx, ty] }
  }
  const conf = 1 - minDist
  return {
    detected: true,
    confidence: parseFloat(conf.toFixed(2)),
    quality: minDist < 0.12 ? 'great' : minDist < 0.25 ? 'good' : 'issue',
    data: { normX, normY, minDist, nearestPt },
  }
}

/** 8. 重复元素构图 */
function detectRepeat(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  // 检测周期性边缘模式（简化：自相关）
  const step = 4
  const rowProfiles: number[] = []
  for (let x = 0; x < w; x += step) {
    let colEdge = 0, cnt = 0
    for (let y = step; y < h; y += step) {
      const idx = (y * w + x) * 4
      const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
      const prevIdx = ((y - step) * w + x) * 4
      const prev = luminance(pixels[prevIdx], pixels[prevIdx + 1], pixels[prevIdx + 2])
      colEdge += Math.abs(l - prev)
      cnt++
    }
    rowProfiles.push(cnt > 0 ? colEdge / cnt : 0)
  }
  // 检测峰值周期性
  let peaks = 0, peakGaps: number[] = [], lastPeak = -1
  for (let i = 1; i < rowProfiles.length - 1; i++) {
    if (rowProfiles[i] > rowProfiles[i - 1] && rowProfiles[i] > rowProfiles[i + 1] && rowProfiles[i] > 15) {
      peaks++
      if (lastPeak >= 0) peakGaps.push(i - lastPeak)
      lastPeak = i
    }
  }
  // 间隙方差小 → 重复规律
  let regularity = 0
  if (peakGaps.length >= 2) {
    const gapMean = peakGaps.reduce((a, b) => a + b, 0) / peakGaps.length
    const gapVar = peakGaps.reduce((s, g) => s + (g - gapMean) ** 2, 0) / peakGaps.length
    regularity = clamp(1 - gapVar / (gapMean * gapMean + 1), 0, 1)
  }
  const score = peaks >= 4 ? regularity : 0
  return {
    detected: score > 0.4,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.7 ? 'great' : score > 0.4 ? 'good' : 'issue',
    data: { peaks, regularity },
  }
}

/** 9. 动态构图 (对角线倾斜) */
function detectDynamic(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const step = Math.max(3, Math.floor(Math.min(w, h) / 60))
  let diagEdges = 0, totalEdges = 0
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const get = (ox: number, oy: number) => {
        const i = ((y + oy * step) * w + (x + ox * step)) * 4
        return luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      }
      const gx = get(1, 0) - get(-1, 0)
      const gy = get(0, 1) - get(0, -1)
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 30) {
        const absAngle = Math.abs(Math.atan2(gy, gx) * 180 / Math.PI)
        if ((absAngle > 30 && absAngle < 60) || (absAngle > 120 && absAngle < 150)) diagEdges++
        totalEdges++
      }
    }
  }
  const diagRatio = totalEdges > 0 ? diagEdges / totalEdges : 0
  return {
    detected: diagRatio > 0.18,
    confidence: parseFloat(diagRatio.toFixed(2)),
    quality: diagRatio > 0.35 ? 'great' : diagRatio > 0.2 ? 'good' : 'issue',
    data: { diagRatio },
  }
}

/** 10. 中央构图 */
function detectCenter(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const midX = Math.floor(w / 2), midY = Math.floor(h / 2)
  const band = Math.floor(Math.min(w, h) * 0.25)
  const step = 4
  let centerWt = 0, totalWt = 0
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4
      const l = luminance(pixels[idx], pixels[idx + 1], pixels[idx + 2])
      const wt = Math.abs(l - 128)
      const dist = Math.sqrt((x - midX) ** 2 + (y - midY) ** 2) / Math.max(w, h)
      centerWt += wt * (1 - dist)
      totalWt += wt
    }
  }
  const centerScore = totalWt > 0 ? centerWt / totalWt : 0
  return {
    detected: centerScore > 0.45,
    confidence: parseFloat(centerScore.toFixed(2)),
    quality: centerScore > 0.65 ? 'great' : centerScore > 0.45 ? 'good' : 'issue',
    data: { centerScore },
  }
}

/** 11. 留白构图 */
function detectWhitespace(
  _pixels: Uint8ClampedArray, sceneInfo: SceneInfo, _w: number, _h: number
): CompositionResult {
  const score = sceneInfo.flatRatio
  return {
    detected: score > 0.4,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.7 ? 'great' : score > 0.4 ? 'good' : 'issue',
    data: { flatRatio: sceneInfo.flatRatio, entityRatio: sceneInfo.entityRatio },
  }
}

/** 12. 几何形状构图 */
function detectGeometry(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  // 检测三角形/圆形结构：统计非水平/非垂直边缘比例
  const step = Math.max(3, Math.floor(Math.min(w, h) / 60))
  let angledEdges = 0, totalEdges = 0
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const get = (ox: number, oy: number) => {
        const i = ((y + oy * step) * w + (x + ox * step)) * 4
        return luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      }
      const gx = get(1, 0) - get(-1, 0)
      const gy = get(0, 1) - get(0, -1)
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 25) {
        const absAngle = Math.abs(Math.atan2(gy, gx) * 180 / Math.PI)
        // 非水平非垂直 → 可能是几何斜边
        if (absAngle > 20 && absAngle < 70) angledEdges++
        totalEdges++
      }
    }
  }
  const score = clamp((totalEdges > 0 ? angledEdges / totalEdges : 0) * 2, 0, 1)
  return {
    detected: score > 0.3,
    confidence: parseFloat(score.toFixed(2)),
    quality: score > 0.55 ? 'great' : score > 0.3 ? 'good' : 'issue',
    data: { angledRatio: totalEdges > 0 ? angledEdges / totalEdges : 0 },
  }
}

/** 水平/垂直线构图 (补充) */
function detectHVLine(
  pixels: Uint8ClampedArray, _sceneInfo: SceneInfo, w: number, h: number
): CompositionResult {
  const step = Math.max(3, Math.floor(Math.min(w, h) / 80))
  let horizEdges = 0, vertEdges = 0, total = 0
  const horizAngles: number[] = []
  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const get = (ox: number, oy: number) => {
        const i = ((y + oy * step) * w + (x + ox * step)) * 4
        return luminance(pixels[i], pixels[i + 1], pixels[i + 2])
      }
      const gx = get(1, 0) - get(-1, 0)
      const gy = get(0, 1) - get(0, -1)
      const mag = Math.sqrt(gx * gx + gy * gy)
      if (mag > 25) {
        const absAngle = Math.abs(Math.atan2(gy, gx) * 180 / Math.PI)
        if (absAngle < 12 || absAngle > 168) { horizEdges++; horizAngles.push(absAngle > 90 ? absAngle - 180 : absAngle) }
        else if (absAngle > 78 && absAngle < 102) vertEdges++
        total++
      }
    }
  }
  const hvRatio = total > 0 ? (horizEdges + vertEdges) / total : 0
  const avgTilt = horizAngles.length > 0
    ? horizAngles.reduce((a, b) => a + b, 0) / horizAngles.length : 0
  const absTilt = Math.abs(avgTilt)
  return {
    detected: hvRatio > 0.3,
    confidence: parseFloat(hvRatio.toFixed(2)),
    quality: absTilt < 1 ? 'great' : absTilt < 3 ? 'good' : 'issue',
    data: { hvRatio, tiltDeg: parseFloat(avgTilt.toFixed(2)), absTilt: parseFloat(absTilt.toFixed(2)) },
  }
}

// ===================================================================
//  Module C: 综合检测 + AI推荐 + 评分
// ===================================================================

/** 并行运行所有12种构图检测 */
export function detectAllCompositions(
  pixels: Uint8ClampedArray, sceneInfo: SceneInfo, w: number, h: number
): Compositions {
  if (sceneInfo.isMinimal && !sceneInfo.hasSubject) {
    const empty = (): CompositionResult => ({ detected: false, confidence: 0, quality: 'issue', data: {} })
    return {
      symmetry: empty(), contrast: empty(), leading: empty(), frame: empty(),
      layering: empty(), point: empty(), thirds: empty(), repeat: empty(),
      dynamic: empty(), center: empty(), whitespace: detectWhitespace(pixels, sceneInfo, w, h),
      geometry: empty(), hvline: detectHVLine(pixels, sceneInfo, w, h),
    }
  }
  return {
    symmetry: detectSymmetry(pixels, sceneInfo, w, h),
    contrast: detectContrast(pixels, sceneInfo, w, h),
    leading: detectLeading(pixels, sceneInfo, w, h),
    frame: detectFrame(pixels, sceneInfo, w, h),
    layering: detectLayering(pixels, sceneInfo, w, h),
    point: detectPoint(pixels, sceneInfo, w, h),
    thirds: detectThirds(pixels, sceneInfo, w, h),
    repeat: detectRepeat(pixels, sceneInfo, w, h),
    dynamic: detectDynamic(pixels, sceneInfo, w, h),
    center: detectCenter(pixels, sceneInfo, w, h),
    whitespace: detectWhitespace(pixels, sceneInfo, w, h),
    geometry: detectGeometry(pixels, sceneInfo, w, h),
    hvline: detectHVLine(pixels, sceneInfo, w, h),
  }
}

/** AI推荐：从检测结果中选出最佳 + 备选构图 */
export function recommendComposition(comps: Compositions, sceneInfo: SceneInfo): {
  primary: string
  backup: string
  primaryQuality: 'great' | 'good' | 'issue'
} {
  const qualityScore = { great: 3, good: 2, issue: 0.5 }
  const sceneBoost: Record<string, Record<string, number>> = {
    arch: { symmetry: 1.3, center: 1.2, geometry: 1.1 },
    landscape: { layering: 1.3, thirds: 1.2, leading: 1.1 },
    portrait: { center: 1.2, thirds: 1.1, symmetry: 1.0 },
    still: { point: 1.3, whitespace: 1.2, center: 1.1 },
    sky: { whitespace: 1.5, point: 1.1 },
    street: { dynamic: 1.3, leading: 1.2, layering: 1.1 },
  }
  const boost = sceneBoost[sceneInfo.scene] || {}

  const scored = Object.entries(comps)
    .filter(([, c]) => c.detected)
    .map(([type, comp]) => ({
      type,
      score: comp.confidence * qualityScore[comp.quality] * (boost[type] || 1),
      quality: comp.quality,
    }))
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return { primary: 'thirds', backup: 'center', primaryQuality: 'good' }
  }
  return {
    primary: scored[0].type,
    backup: scored.length > 1 ? scored[1].type : 'thirds',
    primaryQuality: scored[0].quality,
  }
}

/** 综合评分 */
export function calculateScore(comps: Compositions, sceneInfo: SceneInfo): number {
  let score = 70
  if (sceneInfo.isMinimal && !sceneInfo.hasSubject) return sceneInfo.solidRatio > 0.85 ? 90 : 85

  const weights: Record<string, number> = {
    thirds: 18, center: 12, symmetry: 10, leading: 14, frame: 8,
    dynamic: 6, whitespace: 6, hvline: 12, layering: 8, geometry: 5,
  }
  const qualityScore = { great: 1, good: 0.5, issue: -0.2 }

  for (const [key, comp] of Object.entries(comps)) {
    if (comp && comp.detected && weights[key]) {
      score += weights[key] * qualityScore[comp.quality]
    }
  }

  const hv = comps.hvline
  if (hv.data && typeof hv.data.absTilt === 'number') {
    const absTilt = hv.data.absTilt as number
    if (absTilt > 3) score -= 10
    else if (absTilt > 1.5) score -= 4
  }

  if (sceneInfo.entityRatio > 0.8) score -= 8
  else if (sceneInfo.entityRatio < 0.25 && !sceneInfo.isMinimal) score += 5

  return clamp(Math.round(score), 10, 100)
}

// ===================================================================
//  Module D: 完整分析管程
// ===================================================================

/** 一站式分析：图片 → 分类 → 12种检测 → AI推荐 → 评分 */
export function analyzeImage(
  pixels: Uint8ClampedArray, w: number, h: number
): AnalysisResult {
  const sceneInfo = classifyScene(pixels, w, h)
  const compositions = detectAllCompositions(pixels, sceneInfo, w, h)
  const recommendation = recommendComposition(compositions, sceneInfo)
  const score = calculateScore(compositions, sceneInfo)

  return {
    sceneInfo,
    compositions,
    score,
    primaryComp: recommendation.primary,
    backupComp: recommendation.backup,
    primaryQuality: recommendation.primaryQuality,
  }
}

// ===================================================================
//  Module E: 辅助渲染 — 计算AI推荐的裁剪框和主体点位
// ===================================================================

export interface CropBox {
  x: number; y: number; w: number; h: number  // 相对于图片的比例 0-1
}

export interface SubjectPoint {
  x: number; y: number  // 相对于图片的比例 0-1
}

/** 根据构图类型计算推荐的裁剪框 */
export function getCropBox(compType: string, _w: number, _h: number): CropBox {
  switch (compType) {
    case 'thirds':    return { x: 0, y: 0, w: 1, h: 1 }  // 三分法通常不减画面
    case 'center':    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 } // 微调居中
    case 'whitespace': return { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }
    case 'leading':   return { x: 0, y: 0.05, w: 1, h: 0.9 }
    case 'dynamic':   return { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }
    default:          return { x: 0, y: 0, w: 1, h: 1 }
  }
}

/** 根据构图类型计算推荐的主体点位 */
export function getSubjectPoint(
  compType: string, thirdsData?: { nearestPt?: [number, number] }
): SubjectPoint {
  switch (compType) {
    case 'center':
    case 'symmetry':
      return { x: 0.5, y: 0.5 }
    case 'thirds': {
      const pt = thirdsData?.nearestPt as [number, number] | undefined
      return pt ? { x: pt[0], y: pt[1] } : { x: 2/3, y: 1/3 }
    }
    case 'leading':
      return { x: 0.5, y: 0.62 }  // 消失点附近
    case 'frame':
      return { x: 0.5, y: 0.5 }
    case 'whitespace':
      return { x: 0.35, y: 0.5 }  // 偏左留白
    case 'dynamic':
      return { x: 0.55, y: 0.35 }
    default:
      return { x: 0.5, y: 0.45 }
  }
}
