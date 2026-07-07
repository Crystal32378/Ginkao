// 測試 fetch-conversation.ts 的解析邏輯
// 用合成的 ChatGPT / Claude share HTML 確認解析器能正確抓出對話

import { fetchConversationFromUrl } from '../src/lib/fetch-conversation'

// mock global fetch
const mockHtml = (kind: 'chatgpt' | 'claude') => {
  if (kind === 'chatgpt') {
    const nextData = {
      props: {
        pageProps: {
          serverResponse: {
            data: {
              linear_conversation: [
                {
                  message: {
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: ['我想做一個失憶症治療工具'] },
                  },
                },
                {
                  message: {
                    author: { role: 'assistant' },
                    content: { content_type: 'text', parts: ['好啊，你想怎麼做？'] },
                  },
                },
                {
                  message: {
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: ['一鍵保存對話，後台偷偷總結'] },
                  },
                },
                {
                  message: {
                    author: { role: 'assistant' },
                    content: { content_type: 'text', parts: ['可以。建議用 4 段式記憶結構。'] },
                  },
                },
              ],
            },
          },
        },
      },
    }
    return `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></head><body></body></html>`
  }

  // Claude 風格 — self.__next_f.push
  const chunk1 = JSON.stringify({
    conversation: [
      { role: 'user', content: 'Claude 我想做記憶工具' },
      { role: 'assistant', content: '好啊，我幫你設計' },
      { role: 'user', content: '要支援 MCP 嗎？' },
      { role: 'assistant', content: '可以，MCP 是好選擇' },
    ],
  })
  return `<html><head><script>self.__next_f.push([1, ${JSON.stringify(chunk1)}])</script></head><body></body></html>`
}

const originalFetch = globalThis.fetch
let mockKind: 'chatgpt' | 'claude' = 'chatgpt'
;(globalThis as any).fetch = async (url: string) => {
  return {
    ok: true,
    status: 200,
    text: async () => mockHtml(mockKind),
    headers: new Map(),
  }
}

async function test(kind: 'chatgpt' | 'claude', url: string) {
  mockKind = kind
  console.log(`\n=== ${kind.toUpperCase()} share URL: ${url} ===`)
  try {
    const result = await fetchConversationFromUrl(url)
    console.log('Source:', result.source)
    console.log('Message count:', result.messageCount)
    console.log('Title:', result.title)
    console.log('--- Conversation text ---')
    console.log(result.conversationText)
    console.log('--- End ---')
  } catch (err) {
    console.error('Error:', err)
  }
}

await test('chatgpt', 'https://chatgpt.com/share/abc123')
await test('claude', 'https://claude.ai/share/xyz789')

// Test error cases
console.log('\n=== Invalid URL ===')
try {
  await fetchConversationFromUrl('not a url')
} catch (err) {
  console.log('Expected error:', (err as Error).message)
}

console.log('\n=== Unsupported host ===')
try {
  await fetchConversationFromUrl('https://example.com/share/abc')
} catch (err) {
  console.log('Expected error:', (err as Error).message)
}

;(globalThis as any).fetch = originalFetch
