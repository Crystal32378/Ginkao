import { NextRequest, NextResponse } from 'next/server'
import { fetchConversationFromUrl } from '@/lib/fetch-conversation'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/import-url?url=https://chatgpt.com/share/...
 *
 * 回傳：{ conversationText, source, messageCount, title }
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url query param is required' }, { status: 400 })
  }

  try {
    const result = await fetchConversationFromUrl(url)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
