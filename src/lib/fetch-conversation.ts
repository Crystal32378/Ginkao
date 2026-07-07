// 從 ChatGPT / Claude 的 share URL 抓取完整對話文本
// 這兩個平台的 share 頁面都會把對話嵌在 __NEXT_DATA__ 裡

export interface FetchedConversation {
  conversationText: string
  source: 'chatgpt' | 'claude' | 'unknown'
  messageCount: number
  title?: string
}

const FETCH_TIMEOUT_MS = 15_000

/**
 * 抓取分享連結中的對話。支援：
 *   - https://chatgpt.com/share/{id}
 *   - https://chat.openai.com/share/{id} (舊版)
 *   - https://claude.ai/share/{id}
 */
export async function fetchConversationFromUrl(url: string): Promise<FetchedConversation> {
  const normalized = url.trim()
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('請輸入完整的 URL（包含 https://）')
  }

  let source: FetchedConversation['source'] = 'unknown'
  if (/chatgpt\.com\/share|chat\.openai\.com\/share/i.test(normalized)) {
    source = 'chatgpt'
  } else if (/claude\.ai\/share/i.test(normalized)) {
    source = 'claude'
  } else {
    throw new Error('目前只支援 ChatGPT 與 Claude 的分享連結')
  }

  // 用 AbortController 控制超時
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let html: string
  try {
    const res = await fetch(normalized, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'accept-encoding': 'gzip, deflate, br',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) {
      // ChatGPT 的 Cloudflare 防護會擋 server-side fetch (403)
      // 這不是我們的 bug，是 ChatGPT 設計如此
      if (res.status === 403 && source === 'chatgpt') {
        throw new Error(
          'ChatGPT 分享連結被 Cloudflare 防護擋下了（HTTP 403）。' +
          '請改用「貼對話文本」tab 手動貼對話內容，' +
          '或未來安裝 Chrome 擴充（會在使用者瀏覽器中抓，繞過此限制）。',
        )
      }
      throw new Error(`HTTP ${res.status}`)
    }
    html = await res.text()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('抓取超時（15 秒內沒有回應）')
    }
    throw new Error(`抓取失敗：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    clearTimeout(timeout)
  }

  if (source === 'chatgpt') {
    const parsed = parseChatGptShare(html)
    if (parsed) return parsed
  } else if (source === 'claude') {
    const parsed = parseClaudeShare(html)
    if (parsed) return parsed
  }

  // Fallback：嘗試從 HTML 中萃取可見文字
  const fallbackText = extractVisibleText(html)
  if (fallbackText.length > 100) {
    return {
      conversationText: fallbackText,
      source,
      messageCount: 0,
      title: '(fallback 文字萃取)',
    }
  }

  throw new Error('無法解析這個分享連結。可能是私人的或頁面結構已改變。')
}

// ============== ChatGPT share 解析 ==============
function parseChatGptShare(html: string): FetchedConversation | null {
  const nextData = extractNextData(html)
  if (!nextData) return null

  // ChatGPT share 結構：props.pageProps.serverResponse.data.linear_conversation[]
  // 每個 node 有 .message.author.role 和 .message.content.parts[]
  const linear: any[] | undefined =
    nextData?.props?.pageProps?.serverResponse?.data?.linear_conversation

  if (!Array.isArray(linear)) return null

  const turns: string[] = []
  let title: string | undefined
  let msgCount = 0

  for (const node of linear) {
    const msg = node?.message
    if (!msg) continue
    // system 訊息跳過
    const role = msg?.author?.role
    if (role !== 'user' && role !== 'assistant') continue

    // content 可能是 .parts[] 或 .text
    const content = msg?.content
    let text = ''
    if (Array.isArray(content?.parts)) {
      text = content.parts.filter((p: unknown) => typeof p === 'string').join('\n')
    } else if (typeof content?.text === 'string') {
      text = content.text
    }
    if (!text.trim()) continue

    if (!title && role === 'user') {
      title = text.slice(0, 60) + (text.length > 60 ? '…' : '')
    }

    turns.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
    msgCount++
  }

  if (turns.length === 0) return null

  return {
    conversationText: turns.join('\n\n'),
    source: 'chatgpt',
    messageCount: msgCount,
    title,
  }
}

// ============== Claude share 解析 ==============
function parseClaudeShare(html: string): FetchedConversation | null {
  // Claude 的 share 頁結構會變動。先試 __NEXT_DATA__，再試其他內嵌 JSON。
  const nextData = extractNextData(html)
  if (nextData) {
    const parsed = walkForMessages(nextData)
    if (parsed) return { ...parsed, source: 'claude' }
  }

  // Claude 也可能用 self.__next_f.push(...) 的方式塞資料
  const pushedJson = extractNextFPush(html)
  for (const chunk of pushedJson) {
    const parsed = walkForMessages(chunk)
    if (parsed) return { ...parsed, source: 'claude' }
  }

  return null
}

interface ParsedMessages {
  conversationText: string
  messageCount: number
  title?: string
}

/**
 * 遞迴走訪 JSON 樹，尋找「對話訊息陣列」的樣式
 * 訊息物件通常長得像 { role: 'user'|'assistant', content: string } 或 { author: { role }, content: { text|parts } }
 */
function walkForMessages(node: unknown): ParsedMessages | null {
  if (!node || typeof node !== 'object') return null

  // 找到「陣列中所有元素都是訊息」的陣列
  if (Array.isArray(node)) {
    const msgs = tryParseMessageArray(node)
    if (msgs && msgs.messageCount > 0) return msgs
    for (const item of node) {
      const found = walkForMessages(item)
      if (found) return found
    }
    return null
  }

  // 物件：先看自己是不是單一訊息，不是的話往下走
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = walkForMessages(value)
    if (found) return found
  }
  return null
}

function tryParseMessageArray(arr: unknown[]): ParsedMessages | null {
  const turns: string[] = []
  let msgCount = 0
  let title: string | undefined

  for (const item of arr) {
    if (!item || typeof item !== 'object') return null
    const parsed = tryParseSingleMessage(item as Record<string, unknown>)
    if (!parsed) return null // 陣列中有一個不是訊息 → 這不是訊息陣列

    if (!title && parsed.role === 'user') {
      title = parsed.text.slice(0, 60) + (parsed.text.length > 60 ? '…' : '')
    }
    turns.push(`${parsed.role === 'user' ? 'User' : 'Assistant'}: ${parsed.text}`)
    msgCount++
  }

  if (turns.length === 0) return null
  return { conversationText: turns.join('\n\n'), messageCount: msgCount, title }
}

function tryParseSingleMessage(obj: Record<string, unknown>): { role: 'user' | 'assistant'; text: string } | null {
  // 形式 1: { role: 'user', content: '...' } (Claude 風格)
  const role1 = typeof obj.role === 'string' ? obj.role : null
  if (role1 && (role1 === 'user' || role1 === 'assistant')) {
    const text = extractContentText(obj.content)
    if (text) return { role: role1, text }
  }

  // 形式 2: { author: { role: 'user' }, content: { parts: [...] } } (ChatGPT 風格)
  const author = obj.author as Record<string, unknown> | undefined
  const role2 = typeof author?.role === 'string' ? (author.role as string) : null
  if (role2 && (role2 === 'user' || role2 === 'assistant')) {
    const text = extractContentText(obj.content)
    if (text) return { role: role2 as 'user' | 'assistant', text }
  }

  return null
}

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!content || typeof content !== 'object') return ''
  const c = content as Record<string, unknown>

  if (typeof c.text === 'string') return c.text
  if (Array.isArray(c.parts)) {
    return c.parts.filter((p) => typeof p === 'string').join('\n')
  }
  // Claude 有時是 { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(c.content)) {
    return c.content
      .filter((p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text')
      .map((p) => (p as Record<string, unknown>).text as string)
      .filter((t): t is string => typeof t === 'string')
      .join('\n')
  }
  return ''
}

// ============== HTML 工具 ==============
function extractNextData(html: string): any | null {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

/**
 * Next.js 14+ 用 self.__next_f.push(...) 的方式串流資料
 * 每個 push 內容是一個 JS 字串字面量，內含 JSON
 * 注意：要正確處理 \" 等 escape
 */
function extractNextFPush(html: string): any[] {
  const results: any[] = []
  // 匹配 JS 字串字面量：開頭 "，中間是 (非 " 非 \ 的字元) 或 (\ 加任意字元)，結尾 "
  const re = /self\.__next_f\.push\(\[\s*1,\s*"((?:[^"\\]|\\.)*)"\s*\]\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    // match[1] 是 JS 字串的內容（含 escape sequences）
    // 用 JSON.parse 來正確 unescape — 把內容用 " 包起來就是合法的 JSON 字串
    let raw: string
    try {
      raw = JSON.parse(`"${match[1]}"`)
    } catch {
      continue
    }

    // raw 現在是 unescaped 過的字串，可能是 JSON 物件/陣列
    // 嘗試找到第一個 { 或 [ 開始解析
    const firstBrace = raw.search(/[{[]/)
    if (firstBrace === -1) continue
    const sliced = raw.slice(firstBrace)
    try {
      results.push(JSON.parse(sliced))
    } catch {
      // 可能被截斷，嘗試找到最後一個 } 或 ]
      const lastClose = Math.max(sliced.lastIndexOf('}'), sliced.lastIndexOf(']'))
      if (lastClose > 0) {
        try {
          results.push(JSON.parse(sliced.slice(0, lastClose + 1)))
        } catch {
          /* skip */
        }
      }
    }
  }
  return results
}

function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
}
