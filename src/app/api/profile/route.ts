import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  type ProfileItem,
  type ProfileType,
  PROFILE_TYPES,
  formatProfileProtocol,
  nextProfileItemId,
} from '@/lib/profile'

export const dynamic = 'force-dynamic'

/**
 * GET /api/profile
 *   - 預設回傳所有 active ProfileItem（JSON）
 *   - ?format=protocol → 回傳 Profile Protocol 純文本（給 agent 貼到 system prompt）
 *   - ?include=retired → 也包含 retired
 *   - ?include=suggestions → 也包含 pending suggestions（給 UI review 用）
 */
export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'json'
    const includeRetired = req.nextUrl.searchParams.get('include') === 'retired'
    const includeSuggestions = req.nextUrl.searchParams.get('include') === 'suggestions'

    const where: any = {}
    if (!includeRetired) where.status = 'active'

    const items = await db.profileItem.findMany({
      where,
      orderBy: [{ type: 'asc' }, { itemId: 'asc' }],
    })

    const profileItems: ProfileItem[] = items.map((i) => ({
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

    if (format === 'protocol') {
      const text = formatProfileProtocol(profileItems)
      return new NextResponse(text, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    const response: any = {
      items: profileItems,
      activeCount: profileItems.filter((i) => i.status === 'active').length,
    }

    if (includeSuggestions) {
      const pending = await db.pendingProfileSuggestion.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      })
      response.pendingSuggestions = pending.map((s) => ({
        id: s.id,
        operation: s.operation,
        type: s.type,
        name: s.name,
        content: s.content,
        rationale: s.rationale,
        existingItemId: s.existingItemId,
        sourceProjectId: s.sourceProjectId,
        sourceProjectName: s.sourceProjectName,
        sourcePillId: s.sourcePillId,
        createdAt: s.createdAt.toISOString(),
      }))
      response.pendingCount = pending.length
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[GET /api/profile]', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

/**
 * POST /api/profile
 * 手動新增 ProfileItem（直接 active，不需 review）
 *
 * body: { type, name, content, rationale? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, name, content, rationale } = body ?? {}

    if (!type || !PROFILE_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${PROFILE_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // 取得所有既有的 items 來計算下一個 itemId
    const existingItems = await db.profileItem.findMany()
    const existingProfileItems: ProfileItem[] = existingItems.map((i) => ({
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

    const itemId = nextProfileItemId(existingProfileItems, type as ProfileType)

    const created = await db.profileItem.create({
      data: {
        itemId,
        type,
        name: (name || content.slice(0, 30)).trim(),
        content: content.trim(),
        rationale: rationale?.trim() || null,
        status: 'active',
        source: 'manual',
      },
    })

    return NextResponse.json(
      {
        item: {
          id: created.id,
          itemId: created.itemId,
          type: created.type,
          name: created.name,
          content: created.content,
          rationale: created.rationale,
          status: created.status,
          source: created.source,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/profile/items]', error)
    return NextResponse.json({ error: 'Failed to create profile item' }, { status: 500 })
  }
}
