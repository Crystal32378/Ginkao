import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { distillConversation } from '@/lib/distill'
import { nextItemId, type KnowledgeItem, type KnowledgeType } from '@/lib/brain'
import { type ProfileItem, type ProfileType } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/projects/[id]/distill
 *
 * 蒸餾：把對話文本 + Brain 現況 → delta operation → 套用到 Brain
 *
 * body: { conversationText: string }
 *
 * 回傳：
 *   {
 *     pillId, brainVersion (after), title,
 *     ritual: [...], delta: {add, update, retire},
 *     todayGinkgo: { DECISION: 2, ... },
 *     tokensRead, tokensSavedEstimate
 *   }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const body = await req.json()
    const { conversationText } = body ?? {}

    if (!conversationText || typeof conversationText !== 'string' || conversationText.trim().length === 0) {
      return NextResponse.json({ error: 'conversationText is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 1. 取得 Brain 現況
    const existingItems = await db.knowledgeItem.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    const brainItems: KnowledgeItem[] = existingItems.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      type: i.type as KnowledgeType,
      name: i.name,
      content: i.content,
      rationale: i.rationale,
      confidence: i.confidence,
      status: i.status as 'active' | 'retired',
      sourcePillId: i.sourcePillId,
      supersededById: i.supersededById,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))

    // 1b. 取得 User Profile 現況（跨專案，全局）
    const existingProfileItems = await db.profileItem.findMany({
      orderBy: { createdAt: 'asc' },
    })
    const profileItems: ProfileItem[] = existingProfileItems.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      type: i.type as ProfileType,
      name: i.name,
      content: i.content,
      rationale: i.rationale,
      status: i.status as 'active' | 'retired',
      source: i.source,
      sourceSuggestionId: i.sourceSuggestionId,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))

    const brainVersionBefore = project.brainVersion

    // 2. 建立 Pill（對話 log）— 先建，distill 完成後再更新 title
    const pill = await db.pill.create({
      data: {
        projectId,
        conversationText,
        tokenEstimate: Math.ceil(conversationText.length / 3),
      },
    })

    // 3. 呼叫 LLM 蒸餾（同時蒸餾 Brain + Profile）
    const result = await distillConversation(conversationText, brainItems, brainVersionBefore, profileItems)
    const { delta, profileDelta, title, tokensRead, backend } = result

    // 4. 套用 delta 到 Brain
    const itemsAfter = [...brainItems]
    const addLog: Array<{ itemId: string; type: KnowledgeType }> = []

    // 4a. 處理 retire（先處理，這樣 update 才不會撞到已退役的）
    for (const r of delta.delta.retire) {
      const existing = itemsAfter.find((i) => i.itemId === r.id && i.status === 'active')
      if (!existing) {
        console.warn(`[distill] retire target not found: ${r.id}`)
        continue
      }
      await db.knowledgeItem.update({
        where: { id: existing.id },
        data: {
          status: 'retired',
          supersededById: r.supersededBy,
        },
      })
      existing.status = 'retired'
    }

    // 4b. 處理 update
    for (const u of delta.delta.update) {
      const existing = itemsAfter.find((i) => i.itemId === u.id)
      if (!existing) {
        console.warn(`[distill] update target not found: ${u.id}`)
        continue
      }
      const updateData: any = { updatedAt: new Date() }
      if (u.content) updateData.content = u.content
      if (u.rationale) updateData.rationale = u.rationale
      if (u.confidence != null) updateData.confidence = u.confidence
      await db.knowledgeItem.update({ where: { id: existing.id }, data: updateData })
      if (u.content) existing.content = u.content
      if (u.rationale) existing.rationale = u.rationale
      if (u.confidence != null) existing.confidence = u.confidence
    }

    // 4c. 處理 add
    for (const a of delta.delta.add) {
      const itemId = nextItemId(itemsAfter, a.type)
      const created = await db.knowledgeItem.create({
        data: {
          projectId,
          itemId,
          type: a.type,
          name: a.name || a.content.slice(0, 30),
          content: a.content,
          rationale: a.rationale,
          confidence: a.confidence,
          status: 'active',
          sourcePillId: pill.id,
        },
      })
      itemsAfter.push({
        id: created.id,
        itemId: created.itemId,
        type: created.type as KnowledgeType,
        name: created.name,
        content: created.content,
        rationale: created.rationale,
        confidence: created.confidence,
        status: 'active',
        sourcePillId: created.sourcePillId,
        supersededById: null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      })
      addLog.push({ itemId, type: a.type })
    }

    // 5. Brain 版本 +1，更新 pill title
    const brainVersionAfter = brainVersionBefore + 1
    await db.project.update({
      where: { id: projectId },
      data: { brainVersion: brainVersionAfter, updatedAt: new Date() },
    })
    await db.pill.update({ where: { id: pill.id }, data: { title } })

    // 6. 計算 todayGinkgo 統計
    const todayGinkgo: Record<string, number> = {}
    for (const a of addLog) {
      todayGinkgo[a.type] = (todayGinkgo[a.type] || 0) + 1
    }

    // 7. 估算 tokensSavedEstimate
    // 簡化算法：若下次對話只需讀 Brain（不用讀這次對話全文），省下的 token
    const brainTokens = Math.ceil(
      itemsAfter
        .filter((i) => i.status === 'active')
        .map((i) => `${i.itemId} ${i.type} ${i.content} ${i.rationale || ''}`)
        .join(' ').length / 3,
    )
    const tokensSavedEstimate = Math.max(0, tokensRead - brainTokens)

    // 8. 建立 DistillationLog
    const ritualSteps = JSON.stringify(delta.ritual)
    const deltaSummary = JSON.stringify({
      added: delta.delta.add.length,
      updated: delta.delta.update.length,
      retired: delta.delta.retire.length,
      byType: todayGinkgo,
    })

    // 8a. 把 profileDelta 存成 PendingProfileSuggestion（不直接套用）
    // update / retire 也要保留真正的 Profile type，避免 pending review 與 analytics 看到空語意。
    const profileTypeByItemId = new Map(profileItems.map((item) => [item.itemId, item.type]))
    const profileSuggestionsCreated: Array<{ id: string; type: ProfileType; operation: string }> = []
    for (const a of profileDelta.add) {
      const s = await db.pendingProfileSuggestion.create({
        data: {
          operation: 'add',
          type: a.type,
          name: a.name || a.content.slice(0, 30),
          content: a.content,
          rationale: a.rationale,
          sourcePillId: pill.id,
          sourceProjectId: projectId,
          sourceProjectName: project.name,
          status: 'pending',
        },
      })
      profileSuggestionsCreated.push({ id: s.id, type: a.type, operation: 'add' })
    }
    for (const u of profileDelta.update) {
      const type = profileTypeByItemId.get(u.id)
      if (!type) {
        console.warn(`[distill] profile update target not found: ${u.id}`)
        continue
      }
      const s = await db.pendingProfileSuggestion.create({
        data: {
          operation: 'update',
          type,
          existingItemId: u.id,
          content: u.content,
          rationale: u.rationale,
          sourcePillId: pill.id,
          sourceProjectId: projectId,
          sourceProjectName: project.name,
          status: 'pending',
        },
      })
      profileSuggestionsCreated.push({ id: s.id, type, operation: 'update' })
    }
    for (const r of profileDelta.retire) {
      const type = profileTypeByItemId.get(r.id)
      if (!type) {
        console.warn(`[distill] profile retire target not found: ${r.id}`)
        continue
      }
      const s = await db.pendingProfileSuggestion.create({
        data: {
          operation: 'retire',
          type,
          existingItemId: r.id,
          rationale: r.reason,
          sourcePillId: pill.id,
          sourceProjectId: projectId,
          sourceProjectName: project.name,
          status: 'pending',
        },
      })
      profileSuggestionsCreated.push({ id: s.id, type, operation: 'retire' })
    }

    const profileDeltaSummary = JSON.stringify({
      suggested: profileSuggestionsCreated.length,
      add: profileDelta.add.length,
      update: profileDelta.update.length,
      retire: profileDelta.retire.length,
      byType: profileSuggestionsCreated.reduce((acc, s) => {
        if (s.type) acc[s.type] = (acc[s.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    })

    await db.distillationLog.create({
      data: {
        projectId,
        pillId: pill.id,
        brainVersionBefore,
        brainVersionAfter,
        ritualSteps,
        deltaSummary,
        profileDeltaSummary,
        tokensRead,
        tokensSavedEstimate,
      },
    })

    return NextResponse.json({
      pillId: pill.id,
      title,
      brainVersionBefore,
      brainVersionAfter,
      ritual: delta.ritual,
      delta: delta.delta,
      profileDelta: {
        add: profileDelta.add,
        update: profileDelta.update,
        retire: profileDelta.retire,
        pendingSuggestions: profileSuggestionsCreated.length,
      },
      todayGinkgo,
      tokensRead,
      tokensSavedEstimate,
      backend,
      debug: process.env.NODE_ENV === 'development' ? { rawResponse: result.rawResponse.slice(0, 2000) } : undefined,
    })
  } catch (error) {
    console.error('[POST /api/projects/[id]/distill]', error)
    const message = error instanceof Error ? error.message : 'Failed to distill'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
