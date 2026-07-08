// Ginkgo v2 — 蒸餾引擎
// 收到：Brain 現況 + 新對話
// 輸出：Ritual steps + Delta operations + Today's Ginkgo summary
//
// 不是「總結」，是「delta 運算」：對 Brain 套用 add/update/retire 操作

import ZAI from 'z-ai-web-dev-sdk'
import {
  type KnowledgeItem,
  type DeltaOperation,
  type RitualStep,
  type TodayGinkgo,
  type DistillResult,
  type Confidence,
  type KnowledgeType,
  EMPTY_TODAY,
  TYPE_PREFIX,
  estimateTokens,
} from './brain'

const SYSTEM_PROMPT = `你是「Ginkgo」的蒸餾引擎，負責把冗長的對話蒸餾成持久的專案知識。

# 你的角色

你不是在做摘要。你是一個 Distillation Engine：
- 輸入：當前 Project Brain（已有的知識）+ 一次新對話
- 輸出：對 Brain 的 delta 操作（add / update / retire）

目標是讓 Brain 持續演化，最終成為可被任何模型與 Agent 共用的「專案大腦」。

# Brain 的 8 種知識類型

- DECISION     拍板定案的決策（含為什麼這樣決定）
- CONSTRAINT   外部限制（必須、不能 — 不是團隊選擇，是客觀條件）
- PRINCIPLE    團隊慣例、設計原則（「API 回應必含 request_id」這種）
- DEFINITION   概念定義（「verified user = 完成 email + phone 驗證」這種）— 跨對話必須一致
- FACT         關於世界/技術/使用者的事實（如「ChatGPT share URL 被 Cloudflare 擋」）
- QUESTION     仍待討論的開放問題（被回答後應轉成 FACT 或 DECISION）
- RISK         已知風險 + 緩解方案（有時效性）
- HYPOTHESIS   待驗證假設，必帶 confidence: low/medium/high

# Ritual 步驟（給使用者看的儀式感）

你必須輸出一個 ritual 陣列，描述你的蒸餾過程。每步要有 step 名稱與可選的 detail / tokens / found。
建議步驟（可調整）：
1. "Reading conversation" — detail: tokens read
2. "Comparing with Project Brain" — detail: "N active items"
3. "Finding repeated decisions" — found: N
4. "Removing obsolete knowledge" — found: N
5. "Resolving contradictions" — found: N
6. "Extracting stable principles" — found: N
7. "Compressing project knowledge" — detail: token savings
8. "Building today's capsule" — detail: "vN → vN+1"

# Delta 操作規則

## add（新增）
新增的 item 要給 itemId（如 "D18"）。itemId 格式：
- DECISION → D{n}（D1, D2, D3...）
- CONSTRAINT → C{n}
- PRINCIPLE → P{n}
- DEFINITION → DEF{n}
- FACT → F{n}
- QUESTION → Q{n}
- RISK → R{n}
- HYPOTHESIS → H{n}

流水號在該 type 內獨立遞增。你會在 CURRENT_BRAIN 看到現有最大編號，新編號要接著往下。

每個 add 必須包含：itemId, type, name（簡短標題 ≤ 80 字）, content（主要內容）, rationale（為什麼）。
HYPOTHESIS 必須再加 confidence。

## update（更新既有）
既有 item 的內容需要精煉或修正時用。必須帶 itemId + 至少一個可更新欄位 + reason。
不要把「概念沒變只是換句話說」當 update — 那是無效操作。

## retire（退役）
被推翻、被取代、已過時的 item。必須帶 itemId + reason。
若被新 item 取代，加 supersededBy 指向新 itemId（這個新 item 必須在同一次 delta 的 add 裡）。
退役後 item 保留在 Brain 中（status=retired）以保留演化軌跡。

# 蒸餾原則

1. **品質 > 數量**：寧可不加，也不要加無謂的 item。每個 add 必須有跨對話、跨時間的價值。
2. **重複檢測**：如果對話中討論的事已在 Brain 中，不要重複 add。可考慮 update（強化）或什麼都不做。
3. **矛盾解決**：新對話推翻舊決策時，必須 retire 舊 item 並 add 新的，supersededBy 串起來。
4. **Question 生命週期**：QUESTION 在對話中被回答後，應 retire 該 QUESTION 並 add 對應的 FACT 或 DECISION。
5. **Hypothesis 演化**：HYPOTHESIS 被驗證 → retire 並 add FACT；被推翻 → retire 並 add FACT（記錄「我們學到 X 是錯的」）。
6. **每個 item 都要具體**：禁止「討論了一些事情」這種廢話。name 是簡短標題，content 是具體內容。
7. **rationale 是核心**：DECISION/CONSTRAINT/PRINCIPLE 沒寫 rationale 等於沒寫。

# 輸出格式（純 JSON，不要 markdown 包裹）

{
  "ritual": [
    {"step": "Reading conversation", "detail": "18,432 tokens", "tokens": 18432, "status": "done"},
    {"step": "Comparing with Project Brain", "detail": "23 active items", "status": "done"},
    ...
  ],
  "delta": {
    "add": [
      {
        "itemId": "D18",
        "type": "DECISION",
        "name": "memory structure = 8-type knowledge graph",
        "content": "Brain uses 8 knowledge types: DECISION/CONSTRAINT/PRINCIPLE/DEFINITION/FACT/QUESTION/RISK/HYPOTHESIS",
        "rationale": "8 types cover all amnesia pain points; supersedes 4-section summary"
      },
      ...
    ],
    "update": [
      {"itemId": "P3", "content": "refined content...", "reason": "user clarified scope"}
    ],
    "retire": [
      {"itemId": "H1", "reason": "validated → promoted to F12", "supersededBy": "F12"}
    ]
  },
  "todayGinkgo": {
    "newDecisions": 2,
    "newConstraints": 0,
    "newPrinciples": 1,
    "newDefinitions": 0,
    "newFacts": 1,
    "newQuestions": 0,
    "newRisks": 0,
    "newHypotheses": 0,
    "updatedItems": 1,
    "retiredItems": 1
  },
  "tokensRead": 18432
}

如果對話內容很少或沒有可蒸餾的知識，回傳空的 delta：
{"ritual": [...], "delta": {"add": [], "update": [], "retire": []}, "todayGinkgo": {...all zeros...}, "tokensRead": N}`

export async function distillConversation(
  conversationText: string,
  currentBrain: { items: KnowledgeItem[]; version: number },
): Promise<DistillResult> {
  const backend = (process.env.GINKGO_LLM_BACKEND || 'zai').toLowerCase()
  const tokensRead = estimateTokens(conversationText)

  // 把 Brain 現況格式化給 LLM 看
  const activeItems = currentBrain.items.filter((i) => i.status === 'active')
  const retiredItems = currentBrain.items.filter((i) => i.status === 'retired')

  const brainSnapshot = activeItems
    .map((i) => {
      const conf = i.confidence ? ` (confidence: ${i.confidence})` : ''
      const rat = i.rationale ? `\n  rationale: ${i.rationale}` : ''
      return `[${i.itemId}] ${i.type}  ${i.name}${conf}\n  ${i.content}${rat}`
    })
    .join('\n\n')

  const retiredSummary = retiredItems.length > 0
    ? `\n\n# Retired items（不要重新 activate）\n${retiredItems.map((i) => `[${i.itemId}] RETIRED  ${i.name} → ${i.supersededById ? 'superseded by [' + i.supersededById + ']' : 'reason: archived'}`).join('\n')}`
    : ''

  // 計算各 type 的下一個流水號
  const nextIds: Record<KnowledgeType, number> = {
    DECISION: 1, CONSTRAINT: 1, PRINCIPLE: 1, DEFINITION: 1,
    FACT: 1, QUESTION: 1, RISK: 1, HYPOTHESIS: 1,
  }
  for (const item of currentBrain.items) {
    const prefix = TYPE_PREFIX[item.type]
    const match = item.itemId.match(new RegExp(`^${prefix}(\\d+)$`))
    if (match) {
      const n = parseInt(match[1], 10)
      if (n >= nextIds[item.type]) nextIds[item.type] = n + 1
    }
  }

  const nextIdsHint = Object.entries(nextIds)
    .map(([type, n]) => `${TYPE_PREFIX[type as KnowledgeType]}${n}`)
    .join(', ')

  const userPrompt = `請蒸餾以下對話，對 Brain 套用 delta 操作。

# CURRENT_BRAIN（v${currentBrain.version}，${activeItems.length} active / ${retiredItems.length} retired）

${brainSnapshot || '（Brain 還是空的 — 這是第一次蒸餾）'}${retiredSummary}

# NEXT_ITEM_IDS（新增 item 應使用的編號）

${nextIdsHint}

# CONVERSATION（這次要蒸餾的對話）

${conversationText}

# 輸出

請輸出純 JSON，包含 ritual / delta / todayGinkgo / tokensRead 四個欄位。`

  let rawResponse: string
  if (backend === 'openai') {
    rawResponse = await callOpenAI(SYSTEM_PROMPT, userPrompt)
  } else {
    rawResponse = await callZai(SYSTEM_PROMPT, userPrompt)
  }

  const parsed = parseDistillResult(rawResponse, tokensRead)
  return parsed
}

// ============== Backend: z-ai-web-dev-sdk ==============
async function callZai(systemPrompt: string, userPrompt: string): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'enabled' },
    temperature: 0.3,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

// ============== Backend: OpenAI API ==============
async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is required when GINKGO_LLM_BACKEND=openai')
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI API error: HTTP ${res.status} — ${errText.slice(0, 300)}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

// ============== 解析 LLM 回應 ==============
function parseDistillResult(raw: string, fallbackTokensRead: number): DistillResult {
  let cleaned = raw
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        parsed = null
      }
    }
  }

  if (!parsed) {
    console.error('[Ginkgo] 無法解析 LLM 回覆為 JSON。原始回覆：', raw.slice(0, 500))
    return {
      ritual: [{ step: 'Failed to parse LLM response', status: 'done' }],
      delta: { add: [], update: [], retire: [] },
      todayGinkgo: EMPTY_TODAY,
      tokensRead: fallbackTokensRead,
      rawResponse: raw,
    }
  }

  const delta = normalizeDelta(parsed?.delta)
  const ritual = normalizeRitual(parsed?.ritual)
  const todayGinkgo = normalizeTodayGinkgo(parsed?.todayGinkgo, delta)
  const tokensRead = typeof parsed?.tokensRead === 'number' ? parsed.tokensRead : fallbackTokensRead

  return { ritual, delta, todayGinkgo, tokensRead, rawResponse: raw }
}

function normalizeDelta(d: any): DeltaOperation {
  const validTypes = new Set([
    'DECISION', 'CONSTRAINT', 'PRINCIPLE', 'DEFINITION', 'FACT', 'QUESTION', 'RISK', 'HYPOTHESIS',
  ])
  return {
    add: Array.isArray(d?.add)
      ? d.add
          .filter((x: any) => x && typeof x === 'object' && validTypes.has(x.type) && x.itemId && x.name)
          .map((x: any) => ({
            itemId: String(x.itemId),
            type: x.type as KnowledgeType,
            name: String(x.name),
            content: String(x.content ?? ''),
            rationale: x.rationale ? String(x.rationale) : undefined,
            confidence: ['low', 'medium', 'high'].includes(x.confidence) ? (x.confidence as Confidence) : undefined,
          }))
      : [],
    update: Array.isArray(d?.update)
      ? d.update
          .filter((x: any) => x && typeof x === 'object' && x.itemId)
          .map((x: any) => ({
            itemId: String(x.itemId),
            name: x.name ? String(x.name) : undefined,
            content: x.content ? String(x.content) : undefined,
            rationale: x.rationale ? String(x.rationale) : undefined,
            reason: String(x.reason ?? 'no reason given'),
          }))
      : [],
    retire: Array.isArray(d?.retire)
      ? d.retire
          .filter((x: any) => x && typeof x === 'object' && x.itemId)
          .map((x: any) => ({
            itemId: String(x.itemId),
            reason: String(x.reason ?? 'no reason given'),
            supersededBy: x.supersededBy ? String(x.supersededBy) : undefined,
          }))
      : [],
  }
}

function normalizeRitual(r: any): RitualStep[] {
  if (!Array.isArray(r)) return []
  return r
    .filter((x: any) => x && typeof x === 'object' && typeof x.step === 'string')
    .map((x: any) => ({
      step: String(x.step),
      detail: x.detail ? String(x.detail) : undefined,
      tokens: typeof x.tokens === 'number' ? x.tokens : undefined,
      found: typeof x.found === 'number' ? x.found : undefined,
      status: 'done' as const,
    }))
}

function normalizeTodayGinkgo(t: any, delta: DeltaOperation): TodayGinkgo {
  // 如果 LLM 沒給 todayGinkgo，從 delta 自己算
  if (!t || typeof t !== 'object') {
    const today: TodayGinkgo = { ...EMPTY_TODAY }
    for (const add of delta.add) {
      const key = `new${add.type.charAt(0)}${add.type.slice(1).toLowerCase()}s` as keyof TodayGinkgo
      ;(today[key] as number)++
    }
    today.updatedItems = delta.update.length
    today.retiredItems = delta.retire.length
    return today
  }
  return {
    newDecisions: Number(t.newDecisions) || 0,
    newConstraints: Number(t.newConstraints) || 0,
    newPrinciples: Number(t.newPrinciples) || 0,
    newDefinitions: Number(t.newDefinitions) || 0,
    newFacts: Number(t.newFacts) || 0,
    newQuestions: Number(t.newQuestions) || 0,
    newRisks: Number(t.newRisks) || 0,
    newHypotheses: Number(t.newHypotheses) || 0,
    updatedItems: Number(t.updatedItems) || 0,
    retiredItems: Number(t.retiredItems) || 0,
  }
}
