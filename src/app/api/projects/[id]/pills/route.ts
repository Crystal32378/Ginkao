import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { refineConversation } from '@/lib/refine'
import { type MemorySummary, EMPTY_MEMORY } from '@/lib/memory'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 給 LLM 一點時間

// 煉丹：把這次對話 + 上次記憶 → 新藥丸
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const body = await req.json()
    const { conversationText } = body ?? {}

    if (!conversationText || typeof conversationText !== 'string' || conversationText.trim().length === 0) {
      return NextResponse.json({ error: 'conversationText is required' }, { status: 400 })
    }

    // 確認專案存在
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 取得當前活躍藥丸（作為 previousMemory）
    const currentPill = await db.pill.findFirst({
      where: { projectId, isCurrent: true },
    })
    let previousMemory: MemorySummary | null = null
    if (currentPill) {
      try {
        previousMemory = JSON.parse(currentPill.summaryJson) as MemorySummary
      } catch {
        previousMemory = null
      }
    }

    // 呼叫 LLM 煉丹
    const result = await refineConversation(conversationText, previousMemory)
    const { summary, title } = result

    // 把舊的 current 標成非 current，然後建立新藥丸為 current
    const newPill = await db.$transaction(async (tx) => {
      if (currentPill) {
        await tx.pill.update({
          where: { id: currentPill.id },
          data: { isCurrent: false },
        })
      }

      return tx.pill.create({
        data: {
          projectId,
          previousPillId: currentPill?.id ?? null,
          conversationText,
          summaryJson: JSON.stringify(summary),
          isCurrent: true,
          title,
        },
      })
    })

    // 更新專案 updatedAt
    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      pill: {
        id: newPill.id,
        title: newPill.title,
        summary,
        createdAt: newPill.createdAt,
      },
      backend: result.backend,
      // 除錯用：把 LLM 原始回覆也帶回來（開發期方便看模型輸出）
      debug: process.env.NODE_ENV === 'development' ? { rawResponse: result.rawResponse.slice(0, 2000) } : undefined,
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/pills]', error)
    const message = error instanceof Error ? error.message : 'Failed to refine pill'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 列出這個專案的所有藥丸（含 summaryJson 全文）
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const pills = await db.pill.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    // 解析 summaryJson
    const parsed = pills.map((p) => {
      let summary: MemorySummary = EMPTY_MEMORY
      try {
        summary = JSON.parse(p.summaryJson) as MemorySummary
      } catch {
        /* keep empty */
      }
      return {
        id: p.id,
        title: p.title,
        previousPillId: p.previousPillId,
        isCurrent: p.isCurrent,
        createdAt: p.createdAt,
        summary,
        conversationText: p.conversationText,
      }
    })

    return NextResponse.json({ pills: parsed })
  } catch (error) {
    console.error('[GET /api/projects/[id]/pills]', error)
    return NextResponse.json({ error: 'Failed to list pills' }, { status: 500 })
  }
}
