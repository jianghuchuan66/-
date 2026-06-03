import { NextRequest, NextResponse } from 'next/server'

// ---- OpenRouter API 配置 ----
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL_NAME = "qwen/qwen3-vl-8b-instruct"

// ---- 动态生成提示词（包含图片尺寸） ----
function buildPrompt(w: number, h: number): string {
  return `你是一位拥有20年经验的专业摄影构图评审师。请仔细观察这张尺寸为 ${w}x${h} 像素的照片，给出可用于前端自动裁剪的精确数据。

## 分析要求

### 1. 主体识别
判断照片主体类别："人像" / "风光" / "建筑" / "静物" / "街景" / "极简"

### 2. 构图分析
识别主要构图手法（选一个最匹配的）：
"三分构图" / "对称构图" / "引导线构图" / "框架构图" / "黄金分割" / "中央构图" / "留白构图" / "动态构图" / "对比构图"

### 3. 四边裁剪百分比（非常重要！）
根据构图规则，给出画面四边各应裁剪的百分比：
- 左裁百分比：从画面左侧裁掉的宽度占原图宽度的百分比
- 右裁百分比：从画面右侧裁掉的宽度占原图宽度的百分比
- 上裁百分比：从画面顶部裁掉的高度占原图高度的百分比
- 下裁百分比：从画面底部裁掉的高度占原图高度的百分比

**硬性约束（违反会导致系统崩溃）**：
- 每个百分比必须在 0-50 之间
- 四边百分比之和（左+右+上+下）必须 ≤ 100
- 如果当前构图已经很完美无需裁剪，全部返回 0
- 参考构图规则确定裁剪区域：
  * 三分构图：主体应落在画面1/3或2/3的交点上
  * 中央构图：主体应在画面中心区域
  * 留白构图：主体一侧留出大面积空白
  * 引导线：裁剪使引导线指向主体
  * 黄金分割：主体应在黄金分割点(约0.618处)

### 4. 推荐画幅
"1:1" / "4:3" / "16:9" / "3:2" — 根据画面内容和裁剪后的比例选择最合适的

### 5. 构图评分
0-100的整数，综合考虑主体位置(30分)、画面平衡(25分)、线条运用(20分)、空间留白(15分)、创新性(10分)

### 6. 构图报告
80-150字专业分析，涵盖：识别到的主体、采用的构图手法、画面优点、存在的问题

### 7. 裁剪方案（严格格式）
只写精确的百分比和推荐画幅，格式必须为：
"左侧裁X%、右侧裁Y%、上方裁Z%、下方裁W%，推荐画幅 X:X"
其中X/Y/Z/W就是你在第3步给出的百分比数字，X:X就是你在第4步给出的推荐画幅。

### 8. 理由（纯文字说明，严禁出现百分比数字）
结合构图类型和主体类型，说明为什么采用这样的裁剪方案。
**严禁出现任何百分比数字、阿拉伯数字、数学符号**。字数40-60字。

### 9. AI优化建议（分三点，严禁出现百分比数字）
分三点说明采用该裁剪方案后的具体优化效果。
**严禁出现任何百分比数字、阿拉伯数字、数学符号**。每点15-25字，总字数50-70字。
用中文分号"；"分隔三点。

**关键约束**：字段7（裁剪方案）、字段8（理由）、字段9（AI优化建议）三者内容必须完全不重复。

## 输出格式

严格只输出以下JSON，不要markdown代码块、不要任何额外文字：

{"主体类型":"","构图类型":"","原图宽度":${w},"原图高度":${h},"左裁百分比":0,"右裁百分比":0,"上裁百分比":0,"下裁百分比":0,"推荐画幅":"4:3","构图评分":0,"构图报告":"","裁剪方案":"左侧裁X%、右侧裁Y%、上方裁Z%、下方裁W%，推荐画幅 X:X","理由":"","AI优化建议":""}`
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
          'HTTP-Referer': 'http://localhost:3000',
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

    console.log('[analyze] AI raw response:', content.substring(0, 500))

    // ---- 6. 提取 JSON ----
    let parsedData: Record<string, unknown>
    try {
      let cleaned = content.trim()
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
      }
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

    // ---- 7. 提取并强制校验四边裁剪百分比 ----
    const rawLeft = Number(parsedData.左裁百分比 ?? parsedData.left_crop ?? 0)
    const rawRight = Number(parsedData.右裁百分比 ?? parsedData.right_crop ?? 0)
    const rawTop = Number(parsedData.上裁百分比 ?? parsedData.top_crop ?? 0)
    const rawBottom = Number(parsedData.下裁百分比 ?? parsedData.bottom_crop ?? 0)

    let leftPct = clampPercent(rawLeft)
    let rightPct = clampPercent(rawRight)
    let topPct = clampPercent(rawTop)
    let bottomPct = clampPercent(rawBottom)

    const totalPct = leftPct + rightPct + topPct + bottomPct
    if (totalPct > 100) {
      const scale = 100 / totalPct
      leftPct = Math.floor(leftPct * scale)
      rightPct = Math.floor(rightPct * scale)
      topPct = Math.floor(topPct * scale)
      bottomPct = Math.floor(bottomPct * scale)
      const newTotal = leftPct + rightPct + topPct + bottomPct
      if (newTotal > 100) {
        const excess = newTotal - 100
        const sides = [
          { name: 'left' as const, val: leftPct },
          { name: 'right' as const, val: rightPct },
          { name: 'top' as const, val: topPct },
          { name: 'bottom' as const, val: bottomPct },
        ].sort((a, b) => b.val - a.val)
        for (let i = 0; i < excess; i++) {
          sides[i % 4].val = Math.max(0, sides[i % 4].val - 1)
        }
        leftPct = sides.find(s => s.name === 'left')!.val
        rightPct = sides.find(s => s.name === 'right')!.val
        topPct = sides.find(s => s.name === 'top')!.val
        bottomPct = sides.find(s => s.name === 'bottom')!.val
      }
    }

    console.log(`[analyze] Crop percentages — 左:${leftPct}% 右:${rightPct}% 上:${topPct}% 下:${bottomPct}% (合计:${leftPct+rightPct+topPct+bottomPct}%)`)

    // ---- 8. 提取并验证评分 ----
    const rawScore = Number(parsedData.构图评分 ?? parsedData.composition_score ?? 50)
    const score = Math.max(10, Math.min(100, Math.round(rawScore) || 50))

    // ---- 9. 验证画幅 ----
    const validRatios = ['1:1', '4:3', '16:9', '3:2', '3:4', '9:16']
    const rawRatio = String(parsedData.推荐画幅 ?? parsedData.aspect_ratio ?? '4:3').trim()
    const aspectRatio = validRatios.includes(rawRatio) ? rawRatio : '4:3'

    // ---- 10. 验证主体类型和构图类型 ----
    const validSubjects = ['人像', '风光', '建筑', '静物', '街景', '极简', '通用']
    const validComps = ['三分构图', '对称构图', '引导线构图', '框架构图', '黄金分割', '中央构图', '留白构图', '动态构图', '对比构图', '极简']

    const subjectType = validSubjects.includes(String(parsedData.主体类型 ?? ''))
      ? String(parsedData.主体类型)
      : '通用'

    const compType = validComps.includes(String(parsedData.构图类型 ?? ''))
      ? String(parsedData.构图类型)
      : '三分构图'

    // ---- 11. 构建/校验裁剪方案文案 ----
    const expectedCropPlan = `左侧裁${leftPct}%、右侧裁${rightPct}%、上方裁${topPct}%、下方裁${bottomPct}%，推荐画幅 ${aspectRatio}`
    const rawCropPlan = String(parsedData.裁剪方案 ?? parsedData.crop_plan ?? '')
    // 如果 AI 返回的裁剪方案包含百分比但不匹配实际数据，用我们计算的为准
    const cropPlan = rawCropPlan && rawCropPlan.includes('%')
      ? rawCropPlan
      : expectedCropPlan

    // ---- 12. 提取理由（不含百分比） ----
    const rationale = String(parsedData.理由 ?? parsedData.rationale ?? '')

    // ---- 13. 提取 AI 优化建议（不含百分比） ----
    const aiTips = String(parsedData.AI优化建议 ?? parsedData.ai_tips ?? '')

    // ---- 14. 构建最终响应 ----
    const standardResponse = {
      code: 200,
      msg: "success",
      data: {
        "主体类型": subjectType,
        "构图类型": compType,
        "原图宽度": imgW,
        "原图高度": imgH,
        "左裁百分比": leftPct,
        "右裁百分比": rightPct,
        "上裁百分比": topPct,
        "下裁百分比": bottomPct,
        "推荐画幅": aspectRatio,
        "构图评分": score,
        "构图报告": String(parsedData.构图报告 ?? parsedData.composition_report ?? '分析完成，请查看下方详细数据。'),
        "裁剪方案": cropPlan,
        "理由": rationale,
        "AI优化建议": aiTips,
      },
    }

    console.log('[analyze] Response:', JSON.stringify(standardResponse))

    return NextResponse.json(standardResponse)
  } catch (error) {
    console.error('[analyze] Unexpected error:', error)
    return NextResponse.json(
      { code: 500, msg: "AI分析失败，请重试", data: null },
      { status: 500 }
    )
  }
}

function clampPercent(v: number): number {
  if (isNaN(v)) return 0
  return Math.max(0, Math.min(50, Math.round(v)))
}
