// 從 ChatGPT / Claude 資料匯出 zip 解析 conversations.json
//
// ChatGPT: Settings → Data controls → Export data → email 收 zip → conversations.json
//   結構：Array<{ title, create_time, mapping: { [id]: { message: { author: { role }, content: { parts: [] } } } } }>
//
// Claude: Settings → Account → Export data → zip → conversations.json
//   結構：Array<{ name, created_at, chat_messages: [{ sender, text, created_at }] }>

export interface ImportedConversation {
  id: string // 用 title + created_at hash 當 ID
  title: string
  source: 'chatgpt' | 'claude'
  createdAt: string
  messageCount: number
  conversationText: string // User/Assistant 對話文本（給蒸餾用）
  tokenEstimate: number
}

export interface ImportResult {
  source: 'chatgpt' | 'claude'
  totalConversations: number
  conversations: ImportedConversation[]
  skippedCount: number // 太短或空的對話
}

/**
 * 解析 ChatGPT conversations.json
 *
 * ChatGPT 的 mapping 是一個 nested tree，需要從 root 找到所有 leaf 訊息
 * 然後按 create_time 排序
 */
export function parseChatGptExport(json: any): ImportResult {
  if (!Array.isArray(json)) {
    throw new Error('ChatGPT export 應該是 array')
  }

  const conversations: ImportedConversation[] = []
  let skippedCount = 0

  for (const conv of json) {
    try {
      const title = conv.title || '(untitled)'
      const createTime = conv.create_time
        ? new Date(conv.create_time * 1000).toISOString()
        : new Date().toISOString()

      // 從 mapping 抽出所有 message，按 create_time 排序
      const messages: Array<{ role: string; text: string; createTime?: number }> = []
      const mapping = conv.mapping || {}

      for (const nodeId of Object.keys(mapping)) {
        const node = mapping[nodeId]
        const msg = node?.message
        if (!msg) continue

        const role = msg.author?.role
        if (role !== 'user' && role !== 'assistant') continue

        // content.parts 是 array
        const parts = msg.content?.parts
        let text = ''
        if (Array.isArray(parts)) {
          text = parts.filter((p: unknown) => typeof p === 'string').join('\n')
        }
        if (!text.trim()) continue

        messages.push({
          role,
          text,
          createTime: msg.create_time,
        })
      }

      // 按 createTime 排序（若有）
      messages.sort((a, b) => {
        if (a.createTime == null || b.createTime == null) return 0
        return a.createTime - b.createTime
      })

      if (messages.length < 2) {
        skippedCount++
        continue
      }

      const conversationText = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n')

      if (conversationText.trim().length < 50) {
        skippedCount++
        continue
      }

      const id = `chatgpt-${createTime}-${title.slice(0, 20)}`

      conversations.push({
        id,
        title: title.slice(0, 80),
        source: 'chatgpt',
        createdAt: createTime,
        messageCount: messages.length,
        conversationText,
        tokenEstimate: Math.ceil(conversationText.length / 3),
      })
    } catch (err) {
      console.warn('[Ginkgo] skip ChatGPT conversation due to parse error:', err)
      skippedCount++
    }
  }

  return {
    source: 'chatgpt',
    totalConversations: json.length,
    conversations,
    skippedCount,
  }
}

/**
 * 解析 Claude conversations.json
 */
export function parseClaudeExport(json: any): ImportResult {
  if (!Array.isArray(json)) {
    throw new Error('Claude export 應該是 array')
  }

  const conversations: ImportedConversation[] = []
  let skippedCount = 0

  for (const conv of json) {
    try {
      const title = conv.name || '(untitled)'
      const createdAt = conv.created_at
        ? new Date(conv.created_at).toISOString()
        : new Date().toISOString()

      const chatMessages = conv.chat_messages || []

      if (chatMessages.length < 2) {
        skippedCount++
        continue
      }

      const messages: Array<{ role: string; text: string }> = []
      for (const msg of chatMessages) {
        const sender = msg.sender // 'human' | 'assistant'
        const text = msg.text || ''
        if (!text.trim()) continue
        const role = sender === 'human' ? 'user' : 'assistant'
        messages.push({ role, text })
      }

      if (messages.length < 2) {
        skippedCount++
        continue
      }

      const conversationText = messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n')

      if (conversationText.trim().length < 50) {
        skippedCount++
        continue
      }

      const id = `claude-${createdAt}-${title.slice(0, 20)}`

      conversations.push({
        id,
        title: title.slice(0, 80),
        source: 'claude',
        createdAt,
        messageCount: messages.length,
        conversationText,
        tokenEstimate: Math.ceil(conversationText.length / 3),
      })
    } catch (err) {
      console.warn('[Ginkgo] skip Claude conversation due to parse error:', err)
      skippedCount++
    }
  }

  return {
    source: 'claude',
    totalConversations: json.length,
    conversations,
    skippedCount,
  }
}

/**
 * 自動偵測是 ChatGPT 還是 Claude 的匯出
 */
export function parseConversationExport(json: any): ImportResult {
  if (!Array.isArray(json)) {
    throw new Error('匯出檔案應該是 JSON array')
  }
  if (json.length === 0) {
    throw new Error('匯出檔案是空的')
  }

  // 取第一個物件判斷格式
  const first = json[0]
  if (!first || typeof first !== 'object') {
    throw new Error('無法識別格式')
  }

  // Claude 有 chat_messages
  if ('chat_messages' in first) {
    return parseClaudeExport(json)
  }

  // ChatGPT 有 mapping
  if ('mapping' in first) {
    return parseChatGptExport(json)
  }

  throw new Error('無法識別這是 ChatGPT 還是 Claude 的匯出 — 缺少 mapping 或 chat_messages')
}
