import { NextRequest, NextResponse } from 'next/server'
import { parseConversationExport, type ImportedConversation } from '@/lib/import-export'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/projects/[id]/import-conversations
 *
 * 接收 ChatGPT 或 Claude 的 conversations.json（從資料匯出 zip 拿出來的）
 * 回傳解析後的對話列表，讓使用者在 UI 勾選要蒸餾哪些
 *
 * 不直接蒸餾 — 因為一次蒸餾可能很多對話，使用者要選
 *
 * body: { json: any }  // parsed JSON
 *   或 { rawJson: string }  // 還沒 parse 的字串
 */
export async function POST(req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    let json: unknown

    if (body.json != null) {
      json = body.json
    } else if (typeof body.rawJson === 'string') {
      try {
        json = JSON.parse(body.rawJson)
      } catch {
        return NextResponse.json({ error: 'rawJson 不是合法 JSON' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: '需要 body.json 或 body.rawJson' }, { status: 400 })
    }

    const result = parseConversationExport(json)

    return NextResponse.json({
      source: result.source,
      totalConversations: result.totalConversations,
      parsedCount: result.conversations.length,
      skippedCount: result.skippedCount,
      // 回傳完整 conversationText — local server 沒有頻寬問題，UI 端選取後直接用
      conversations: result.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        source: c.source,
        createdAt: c.createdAt,
        messageCount: c.messageCount,
        tokenEstimate: c.tokenEstimate,
        conversationText: c.conversationText,
        // 預覽前 200 字（給 UI 列表顯示用）
        preview: c.conversationText.slice(0, 200) + (c.conversationText.length > 200 ? '…' : ''),
      })),
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/import-conversations]', error)
    const message = error instanceof Error ? error.message : 'Failed to parse'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/**
 * GET — 回傳使用說明
 */
export async function GET() {
  return NextResponse.json({
    description: '匯入 ChatGPT 或 Claude 的資料匯出',
    usage: {
      step1: '到 ChatGPT/Claude Settings → Export data → 收 email → 解 zip',
      step2: '找到 conversations.json',
      step3: 'POST 到這個端點，body: { json: <parsed conversations.json> }',
      step4: '從回傳的 conversations 陣列中選擇要蒸餾的，再呼叫 /api/projects/[id]/distill',
    },
    note: '這個端點只解析，不蒸餾。一次匯出可能幾百個對話，使用者要自己選哪些值得蒸餾',
  })
}

// 型別轉換 helper（給其他模組用）
export type { ImportedConversation }
