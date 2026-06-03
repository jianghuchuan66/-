import { NextRequest, NextResponse } from 'next/server'

// ---- OpenRouter API 配置 ----
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL_NAME = "qwen/qwen3-vl-8b-instruct"

// ---- 动态生成提示词（包含图片尺寸） ----
function buildPrompt(w: number, h: number): string {
  return `你是世界顶级专业摄影构图大师，拥有20年风光、建筑、人像摄影经验。

你的任务是：像人类摄影师一样思考，大胆裁剪，只保留最有价值的画面内容。

请仔细观察这张尺寸为 ${w}x${h} 像素的照片，给出可用于前端自动裁剪的精确数据。

## 核心原则（必须严格遵守）

### 1. 强制修改规则
构图评分低于80分的照片，**必须进行裁剪修改**，绝对不能返回"无需修改"或只做小于1%的象征性裁剪。只有评分≥80分且构图已经非常完美的照片才可以保持原样。

### 2. 主体优先
画面中最显眼、最有特色的元素就是唯一主体，所有裁剪都围绕主体进行。识别主体时遵循以下优先级（从高到低）：
- 建筑类：古建筑、地标建筑、特色屋顶、精美雕刻 > 天空 > 路面 > 路人
- 风光类：雪山、湖泊、瀑布、山脉、日出日落 > 天空 > 路面 > 杂物
- 人像类：人物面部、全身 > 背景 > 其他人物
- 静物类：主体物品 > 桌面 > 背景

**重要**：天空优先级高于路面，有美感的天空（蓝天白云、晚霞、层次云）应该适当保留，不要全部裁掉。

### 3. 大胆裁剪
不需要保守，该裁就裁，裁剪目标不是删光背景，而是去掉干扰主体的杂物。具体裁剪上限按第3步的题材区分标准执行。

### 4. 去除冗余
裁掉杂乱地面、无关路人、多余树枝、边角杂物。但以下有美感的元素可以适当保留：
- 有层次感的天空、干净的水面、简洁的墙面
- **优美的引导线**：海岸线、栏杆、道路延伸线、河流曲线等，这些是引导线构图的核心元素
- 总之，能为主体服务、增强画面氛围的背景元素都应保留

### 5. 视觉集中
主体突出即可，无需占满整个画面。有美感的背景可以作为氛围元素保留。观众视线应该自然被主体吸引，画面整体舒适和谐。

### 6. 构图标准
从以下12种构图手法中选择最优的一种：
"三分构图" / "对称构图" / "引导线构图" / "框架构图" / "中心构图" / "留白构图" / "重复元素构图" / "对角线构图" / "几何形状构图" / "分层构图" / "动态构图" / "黄金分割构图"

---

## 分析要求

### 1. 主体识别
判断照片主体类别："人像" / "风光" / "建筑" / "静物" / "街景" / "极简"

### 2. 构图分析
从上述12种构图手法中选择最匹配的一种。

### 3. 题材区分裁剪标准（必须严格遵守不同题材的裁剪上限）
根据主体类型，采用不同的裁剪策略：

**风光、建筑类**：
- 核心原则：保留画面环境与空间氛围感，严禁过度裁切至只剩主体
- 只修整多余杂乱留白、失衡边角，维持画面完整性
- 有美感的天空、水面、引导线（海岸线、栏杆、道路）必须保留
- **单边裁剪上限20%，四边合计不超过55%**

**人像类**：
- 核心原则：人物作为画面核心主体，合理裁除冗余杂乱背景、无效空白
- 聚焦人物，可适度加大裁切幅度
- 能保留全身就保留全身（面部特写除外）
- **单边裁剪上限35%，四边合计不超过60%**

**静物类**：
- 核心原则：适度精简多余空白，兼顾物品摆放环境，不极端裁切
- **单边裁剪上限25%，四边合计不超过50%**

### 4. 四边裁剪百分比
根据对应题材的裁剪上限，给出画面四边各应裁剪的百分比：
- 左裁百分比：从画面左侧裁掉的宽度占原图宽度的百分比
- 右裁百分比：从画面右侧裁掉的宽度占原图宽度的百分比
- 上裁百分比：从画面顶部裁掉的高度占原图高度的百分比
- 下裁百分比：从画面底部裁掉的高度占原图高度的百分比

**硬性约束（违反会导致系统崩溃）**：
- **绝对不能裁掉主体**：裁剪框必须完整包含画面中唯一主体的100%，不能裁掉主体的任何部分。关键规则：
  * 弹钢琴的人必须保留完整的身体和钢琴，不能裁成半个人
  * 建筑不能裁掉屋顶或基座
  * **人物全身照**：能保留全身就保留全身，不要裁成半身像（人物面部特写除外）
  * **人脸特写**：不能裁掉下巴、额头、耳朵
  * 总之，裁剪只去掉边缘冗余，绝不切穿主体
- **严格遵守第3步的题材区分数值上限**
- **评分低于80分必须裁剪，不能返回全0**。只有评分≥80分且构图已完美才可全0
- 裁剪去掉的是干扰主体的冗余区域，不是主体本身
- 参考构图规则确定裁剪区域：
  * 三分构图：主体应落在画面1/3或2/3的交点上
  * 中心构图：主体应在画面中心区域
  * 留白构图：主体一侧留出大面积空白
  * 引导线：裁剪使引导线指向主体
  * 黄金分割：主体应在黄金分割点(约0.618处)

### 4. 推荐画幅
"1:1" / "4:3" / "16:9" / "3:2" — 根据画面内容和裁剪后的比例选择最合适的

### 5. 构图评分
0-100的整数，综合考虑主体突出度(35分)、画面简洁度(25分)、线条引导性(20分)、视觉冲击力(20分)。
评分标准：
- 0-59分：主体不突出，画面杂乱，需要大幅裁剪
- 60-79分：主体可辨认，但有明显冗余，需要针对性裁剪
- 80-89分：构图较好，仅需微调
- 90-100分：构图完美，无需修改

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
    if (totalPct > 60) {
      const scale = 60 / totalPct
      leftPct = Math.floor(leftPct * scale)
      rightPct = Math.floor(rightPct * scale)
      topPct = Math.floor(topPct * scale)
      bottomPct = Math.floor(bottomPct * scale)
      const newTotal = leftPct + rightPct + topPct + bottomPct
      if (newTotal > 60) {
        const excess = newTotal - 60
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
    const validComps = ['三分构图', '对称构图', '引导线构图', '框架构图', '黄金分割构图', '黄金分割', '中心构图', '留白构图', '重复元素构图', '对角线构图', '几何形状构图', '分层构图', '动态构图', '对比构图', '极简']

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
  return Math.max(0, Math.min(35, Math.round(v)))
}
