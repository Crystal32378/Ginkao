// Debug Claude __next_f.push regex + walkForMessages
import { fetchConversationFromUrl } from '../src/lib/fetch-conversation'

const chunk = JSON.stringify({
  conversation: [
    { role: 'user', content: 'Claude 我想做記憶工具' },
    { role: 'assistant', content: '好啊，我幫你設計' },
    { role: 'user', content: '要支援 MCP 嗎？' },
    { role: 'assistant', content: '可以，MCP 是好選擇' },
  ],
})

const html = `<html><head><script>self.__next_f.push([1, ${JSON.stringify(chunk)}])</script></head><body></body></html>`

// 模擬 fetch
;(globalThis as any).fetch = async (url: string) => ({
  ok: true,
  status: 200,
  text: async () => html,
  headers: new Map(),
})

try {
  const result = await fetchConversationFromUrl('https://claude.ai/share/xyz789')
  console.log('SUCCESS:', JSON.stringify(result, null, 2))
} catch (err) {
  console.log('FAILED:', (err as Error).message)
}
