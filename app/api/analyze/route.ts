import { NextRequest, NextResponse } from 'next/server'

// ---- OpenRouter API 配置 ----
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL_NAME = "qwen/qwen3-vl-8b-instruct"

// ---- 动态生成提示词（包含图片尺寸） ----
function buildPrompt(w: number, h: number): string {
  return `你是一位拥有20年经验的专业摄影构图评审师。请仔细观察这张尺寸为 ${w}x${h} 像素的照片，给出可用于前端自动修图的精确数据。

## 分析要求

### 1. 主体识别
判断照片主体类别："人像" / "风光" / "建筑" / "静物" / "街景" / "极简"

### 2. 构图分析
识别主要构图手法（选一个最匹配的）：
"三分构图" / "对称构图" / "引导线构图" / "框架构图" / "黄金分割" / "中央构图" / "留白构图" / "动态构图" / "对比构图"

### 3. 水平线检测
- 画面倾斜角度：观察地平线、建筑边缘等参考线，估算偏离水平的角度（正值为顺时针倾斜，负值为逆时针，精确到0.1度）
- 推荐旋转角度：矫正倾斜需要的旋转量（与倾斜角度符号相反），范围 -10 到 +10 度

### 4. 最优裁剪框（非常重要！）
- 格式：[x, y, width, height]，全部是整数像素值
- 这是 [左上角x坐标, 左上角y坐标, 框的宽度, 框的高度]，不是 [x1, y1, x2, y2] 对角坐标
- 图片总尺寸为 ${w}x${h} 像素
- **硬性约束（违反会导致系统崩溃）**：
  x 必须 >= 0
  y 必须 >= 0
  x + width 必须 <= ${w}
  y + height 必须 <= ${h}
- 如果当前构图已经很完美无需裁剪，返回 [0, 0, ${w}, ${h}]
- 参考构图规则确定裁剪区域：
  * 三分构图：主体应落在画面1/3或2/3的交点上
  * 中央构图：主体应在画面中心区域
  * 留白构图：主体一侧留出大面积空白
  * 引导线：裁剪使引导线指向主体
  * 黄金分割：主体应在黄金分割点(约0.618处)

### 5. 推荐画幅
"1:1" / "4:3" / "16:9" / "3:2" — 根据画面内容和裁剪后的比例选择最合适的

### 6. 构图评分
0-100的整数，综合考虑主体位置(30分)、画面平衡(25分)、线条运用(20分)、空间留白(15分)、创新性(10分)

### 7. 构图报告
80-150字专业分析，涵盖：识别到的主体、采用的构图手法、画面优点、存在的问题

### 8. 优化建议
40-80字具体可操作的改进方法

## 输出格式

严格只输出以下JSON，不要markdown代码块、不要任何额外文字：

{"主体类型":"","构图类型":"","原图宽度":${w},"原图高度":${h},"画面倾斜角度":0,"推荐旋转角度":0,"最优裁剪框":[0,0,${w},${h}],"推荐画幅":"4:3","构图评分":0,"构图报告":"","优化建议":""}`
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1. 解析请求体 ----
    const body = await request.json()
    const { image, width, height } = body as {
      image?: string
      width?: number
      height?: number
    }

    if (!image) {
      return NextResponse.json(
        { code: 400, msg: "缺少图片数据", data: null },
        { status: 400 }
      )
    }

    const imgW = typeof width === 'number' && width > 0 ? Math.round(width) : 800
    const imgH = typeof height === 'number' && height > 0 ? Math.round(height) : 600

    // ---- 2. 动态构建提示词 ----
    const promptText = buildPrompt(imgW, imgH)

    // ---- 3. 调用 OpenRouter API ----
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)

    let response: Response
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3333',
          'X-Title': 'AI Composition Analyzer',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: promptText,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    // ---- 4. 处理 API 错误 ----
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[analyze] OpenRouter API error:', response.status, errorText.substring(0, 300))
      return NextResponse.json(
        { code: 500, msg: "AI分析失败，请重试", data: null },
        { status: 500 }
      )
    }

    // ---- 5. 解析 AI 返回 ----
    const result = await response.json()
    const content: string = result.choices?.[0]?.message?.content || ''

    if (!content) {
      console.error('[analyze] Empty response from AI')
      return NextResponse.json(
        { code: 500, msg: "AI分析失败，请重试", data: null },
        { status: 500 }
      )
    }

    console.log('[analyze] AI raw response:', content.substring(0, 400))

    // ---- 6. 提取 JSON ----
    let parsedData: Record<string, unknown>
    try {
      // 移除可能的 markdown 代码块
      let cleaned = content.trim()
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
      }
      // 匹配最外层 JSON 对象
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0])
      } else {
        parsedData = JSON.parse(cleaned)
      }
    } catch (parseError) {
      console.error('[analyze] Failed to parse AI response:', content.substring(0, 500))
      return NextResponse.json(
        { code: 500, msg: "AI返回格式解析失败，请重试", data: null },
        { status: 500 }
      )
    }

    // ---- 7. 提取并验证裁剪框 ----
    const rawCrop = (parsedData.最优裁剪框 ?? parsedData.crop_box ?? [0, 0, imgW, imgH]) as number[]
    let cropArray = Array.isArray(rawCrop) && rawCrop.length === 4
      ? rawCrop.map(Number)
      : [0, 0, imgW, imgH]

    // 校验裁剪框合法性（零容忍：必须严格在图片范围内）
    const [cx, cy, cw, ch] = cropArray
    const isValid =
      cw > 0 && ch > 0 &&
      cx >= 0 && cy >= 0 &&
      (cx + cw) <= imgW &&
      (cy + ch) <= imgH

    if (!isValid) {
      console.warn(`[analyze] Invalid crop box [${cropArray}], using full image [0,0,${imgW},${imgH}]`)
      cropArray = [0, 0, imgW, imgH]
    }

    // 二次钳制到图片范围内（兜底）
    cropArray[0] = Math.max(0, Math.min(Math.round(cropArray[0]), imgW - 1))
    cropArray[1] = Math.max(0, Math.min(Math.round(cropArray[1]), imgH - 1))
    cropArray[2] = Math.max(1, Math.min(Math.round(cropArray[2]), imgW - cropArray[0]))
    cropArray[3] = Math.max(1, Math.min(Math.round(cropArray[3]), imgH - cropArray[1]))

    // ---- 8. 提取并验证评分 ----
    const rawScore = Number(parsedData.构图评分 ?? parsedData.composition_score ?? 50)
    const score = Math.max(10, Math.min(100, Math.round(rawScore) || 50))

    // ---- 9. 提取并验证旋转角度 ----
    const tiltAngle = clampNumber(Number(parsedData.画面倾斜角度 ?? parsedData.tilt_angle ?? 0), -45, 45)
    const rotationAngle = clampNumber(Number(parsedData.推荐旋转角度 ?? parsedData.rotation_angle ?? 0), -10, 10)

    // ---- 10. 验证画幅 ----
    const validRatios = ['1:1', '4:3', '16:9', '3:2', '3:4', '9:16']
    const rawRatio = String(parsedData.推荐画幅 ?? parsedData.aspect_ratio ?? '4:3').trim()
    const aspectRatio = validRatios.includes(rawRatio) ? rawRatio : '4:3'

    // ---- 11. 验证主体类型和构图类型 ----
    const validSubjects = ['人像', '风光', '建筑', '静物', '街景', '极简', '通用']
    const validComps = ['三分构图', '对称构图', '引导线构图', '框架构图', '黄金分割', '中央构图', '留白构图', '动态构图', '对比构图', '极简']

    const subjectType = validSubjects.includes(String(parsedData.主体类型 ?? ''))
      ? String(parsedData.主体类型)
      : '通用'

    const compType = validComps.includes(String(parsedData.构图类型 ?? ''))
      ? String(parsedData.构图类型)
      : '三分构图'

    // ---- 12. 构建最终响应 ----
    const standardResponse = {
      code: 200,
      msg: "success",
      data: {
        "主体类型": subjectType,
        "构图类型": compType,
        "原图宽度": imgW,
        "原图高度": imgH,
        "画面倾斜角度": tiltAngle,
        "推荐旋转角度": rotationAngle,
        "最优裁剪框": cropArray,
        "推荐画幅": aspectRatio,
        "构图评分": score,
        "构图报告": String(parsedData.构图报告 ?? parsedData.composition_report ?? '分析完成，请查看下方详细数据。'),
        "优化建议": String(parsedData.优化建议 ?? parsedData.suggestions ?? '建议根据构图报告中的指引进行微调。'),
      },
    }

    console.log('[analyze] Response:', JSON.stringify({
      ...standardResponse,
      data: { ...standardResponse.data, "最优裁剪框": cropArray, "构图评分": score }
    }))

    return NextResponse.json(standardResponse)
  } catch (error) {
    console.error('[analyze] Unexpected error:', error)
    return NextResponse.json(
      { code: 500, msg: "AI分析失败，请重试", data: null },
      { status: 500 }
    )
  }
}

function clampNumber(v: number, min: number, max: number): number {
  if (isNaN(v)) return 0
  return Math.max(min, Math.min(max, v))
}
