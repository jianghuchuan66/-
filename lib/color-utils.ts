/**
 * 摄影Vibe — 取色换背景颜色工具库
 *
 * 核心取色流程：
 *  1. 裁取图片中心65%区域，剔除暗角黑边
 *  2. HSV 过滤：丢弃 V＜30 死黑像素、S＜8 纯灰像素
 *  3. 无有效像素时兜底返回 #E2E2E2
 *  4. color-thief 频率分析法提取唯一主色
 *  5. 后处理：饱和度仅降15%、强制明度≥60，杜绝暗沉发黑
 */

// ---- 类型定义 ----

export interface RGBColor {
  r: number // 0-255
  g: number
  b: number
}

export interface HSLColor {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export interface HSVColor {
  h: number // 0-360
  s: number // 0-100
  v: number // 0-100
}

// ============================================================
// 1. 核心：图片 → 主色 HEX（完整5步管线）
// ============================================================

/**
 * 从图片提取经过后处理的唯一主色
 *
 * 入参：HTMLImageElement（已加载的图片对象）
 * 输出：标准 HEX 色值（如 #3A7B5E）
 *
 * 供 extractDominantColor() 内部调用，
 * 也可外部直接使用（入参为 img 对象时）。
 */
export function extractColorFromImage(img: HTMLImageElement): string {
  const natW = img.naturalWidth
  const natH = img.naturalHeight

  // ---- 第1步：裁取图片中心 65% 区域，剔除四周暗角/黑边 ----
  const cropW = Math.round(natW * 0.65)
  const cropH = Math.round(natH * 0.65)
  const sx = Math.round((natW - cropW) / 2)
  const sy = Math.round((natH - cropH) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH)

  // ---- 第2步：遍历全部像素，HSV 过滤 ----
  const imageData = ctx.getImageData(0, 0, cropW, cropH)
  const pixels = imageData.data
  const validPixels: Array<{ r: number; g: number; b: number }> = []

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]

    if (a < 128) continue // 跳过透明像素

    const hsv = rgbToHsv(r, g, b)

    // 丢弃死黑像素（V＜30）和纯灰无色彩像素（S＜8）
    if (hsv.v < 30) continue
    if (hsv.s < 8) continue

    validPixels.push({ r, g, b })
  }

  // ---- 第3步：无有效亮色像素时兜底 ----
  if (validPixels.length === 0) {
    return '#E2E2E2'
  }

  // ---- 第4步：color-thief 风格 — 量化后找像素占比最高的主色 ----
  const dominant = findDominantByQuantize(validPixels)

  // ---- 第5步：色彩后处理 ----
  //  饱和度仅降 15%（不再大幅去饱和避免发灰）
  //  强制明度最低 60，杜绝暗沉发黑的颜色
  const hsv = rgbToHsv(dominant.r, dominant.g, dominant.b)
  hsv.s = Math.max(0, hsv.s * 0.85)          // 降 15%
  hsv.v = Math.max(60, hsv.v)                 // 最低明度 60

  const final = hsvToRgb(hsv.h, hsv.s, hsv.v)

  return rgbToHex(final.r, final.g, final.b)
}

// ============================================================
// 2. 对外接口 — 保持与旧版 extractDominantColor 签名一致
// ============================================================

/**
 * 从图片 src 中提取主色（外部调用入口，与原函数签名一致）
 * @param imageSrc - 图片 URL 或 data URL
 * @returns 主色 RGB
 */
export async function extractDominantColor(imageSrc: string): Promise<RGBColor> {
  const img = await loadImage(imageSrc)
  const hex = extractColorFromImage(img)
  return hexToRgb(hex)!
}

// ============================================================
// 3. 颜色预处理 — 新版：仅微调（核心处理已在 extractColorFromImage 完成）
// ============================================================

/**
 * 对主色做轻量预处理（与旧版接口保持一致，参数已更新）：
 *  - 饱和度降低 15%（仅微调，不再大幅去饱和）
 *  - 强制明度最低 60（杜绝暗沉）
 */
export function preprocessColor(color: RGBColor): RGBColor {
  const hsv = rgbToHsv(color.r, color.g, color.b)

  // 饱和度仅降 15%
  hsv.s = Math.max(0, hsv.s * 0.85)

  // 明度不低于 60
  hsv.v = Math.max(60, hsv.v)

  return hsvToRgb(hsv.h, hsv.s, hsv.v)
}

/**
 * 根据饱和度系数调整颜色（用于滑块实时预览）
 * @param color 原始 RGB 颜色
 * @param factor 饱和度系数，0=全灰，1=原始饱和度
 */
export function adjustSaturation(color: RGBColor, factor: number): RGBColor {
  const hsv = rgbToHsv(color.r, color.g, color.b)
  hsv.s = Math.max(0, Math.min(100, hsv.s * factor))
  return hsvToRgb(hsv.h, hsv.s, hsv.v)
}

// ============================================================
// 4. 明度计算 — 文字对比度适配
// ============================================================

/**
 * 计算感知亮度（加权灰度值）
 * 公式：0.299R + 0.587G + 0.114B
 * @returns 0-255 的明度值
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 根据背景色明度返回最佳文字颜色
 * 明度 > 160 → 黑色文字
 * 明度 < 160 → 白色文字
 */
export function getTextColor(bgColor: RGBColor): '#000000' | '#ffffff' {
  const lum = getLuminance(bgColor.r, bgColor.g, bgColor.b)
  return lum > 160 ? '#000000' : '#ffffff'
}

// ============================================================
// 5. 颜色格式转换
// ============================================================

/** RGB → HEX 字符串（含 # 前缀） */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** HEX → RGB，失败返回 null */
export function hexToRgb(hex: string): RGBColor | null {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return null
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  return { r, g, b }
}

// ---- 基础工具函数：RGB ↔ HSV ----

/**
 * RGB → HSV
 * @returns h:0-360, s:0-100, v:0-100
 */
export function rgbToHsv(r: number, g: number, b: number): HSVColor {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255

  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const delta = max - min

  let h = 0
  let s = 0
  const v = max * 100

  if (max !== 0) {
    s = (delta / max) * 100
  }

  if (delta !== 0) {
    if (max === nr) {
      h = 60 * (((ng - nb) / delta) % 6)
    } else if (max === ng) {
      h = 60 * (((nb - nr) / delta) + 2)
    } else {
      h = 60 * (((nr - ng) / delta) + 4)
    }
  }

  if (h < 0) h += 360

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  }
}

/**
 * HSV → RGB
 * @param h 0-360, s 0-100, v 0-100
 */
export function hsvToRgb(h: number, s: number, v: number): RGBColor {
  const nh = h / 60
  const ns = s / 100
  const nv = v / 100

  const c = nv * ns
  const x = c * (1 - Math.abs((nh % 2) - 1))
  const m = nv - c

  let nr = 0, ng = 0, nb = 0

  if (nh < 1)      { nr = c; ng = x; nb = 0 }
  else if (nh < 2) { nr = x; ng = c; nb = 0 }
  else if (nh < 3) { nr = 0; ng = c; nb = x }
  else if (nh < 4) { nr = 0; ng = x; nb = c }
  else if (nh < 5) { nr = x; ng = 0; nb = c }
  else             { nr = c; ng = 0; nb = x }

  return {
    r: Math.round((nr + m) * 255),
    g: Math.round((ng + m) * 255),
    b: Math.round((nb + m) * 255),
  }
}

// ---- 保留 HSL 转换（供外部可能的兼容调用） ----

/** RGB → HSL */
export function rgbToHsl(r: number, g: number, b: number): HSLColor {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255

  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const delta = max - min

  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)

    switch (max) {
      case nr:
        h = ((ng - nb) / delta + (ng < nb ? 6 : 0)) / 6
        break
      case ng:
        h = ((nb - nr) / delta + 2) / 6
        break
      case nb:
        h = ((nr - ng) / delta + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** HSL → RGB */
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  const nh = h / 360
  const ns = s / 100
  const nl = l / 100

  if (ns === 0) {
    const v = Math.round(nl * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns
  const p = 2 * nl - q

  return {
    r: Math.round(hue2rgb(p, q, nh + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, nh) * 255),
    b: Math.round(hue2rgb(p, q, nh - 1 / 3) * 255),
  }
}

// ============================================================
// 6. 内部工具
// ============================================================

/**
 * color-thief 风格：对已过滤像素做颜色量化，找像素占比最高的主色
 *
 * 量化阶梯 24（≈10.6 级/通道），平衡精度与抗噪
 */
function findDominantByQuantize(
  pixels: Array<{ r: number; g: number; b: number }>,
): RGBColor {
  const STEP = 24
  const buckets = new Map<
    number,
    { rSum: number; gSum: number; bSum: number; count: number }
  >()

  for (const p of pixels) {
    const qr = Math.round(p.r / STEP) * STEP
    const qg = Math.round(p.g / STEP) * STEP
    const qb = Math.round(p.b / STEP) * STEP
    const key = ((qr & 0xff) << 16) | ((qg & 0xff) << 8) | (qb & 0xff)

    const b = buckets.get(key)
    if (b) {
      b.rSum += p.r
      b.gSum += p.g
      b.bSum += p.b
      b.count++
    } else {
      buckets.set(key, { rSum: p.r, gSum: p.g, bSum: p.b, count: 1 })
    }
  }

  let maxCount = 0
  let dominant: RGBColor = { r: 226, g: 226, b: 226 } // 兜底浅灰

  for (const bucket of buckets.values()) {
    if (bucket.count > maxCount) {
      maxCount = bucket.count
      dominant = {
        r: Math.round(bucket.rSum / bucket.count),
        g: Math.round(bucket.gSum / bucket.count),
        b: Math.round(bucket.bSum / bucket.count),
      }
    }
  }

  return dominant
}

/** 加载图片 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** RGB → CSS 字符串 */
export function rgbToCss(color: RGBColor): string {
  return `rgb(${color.r},${color.g},${color.b})`
}
