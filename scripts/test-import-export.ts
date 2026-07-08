// 測試 import-export.ts 的 parser

import { parseChatGptExport, parseClaudeExport, parseConversationExport } from '../src/lib/import-export'

// === Test 1: ChatGPT 格式 ===
const chatgptExport = [
  {
    title: 'Ginkgo 設計討論',
    create_time: 1720000000,
    mapping: {
      root: { message: null, children: ['a', 'b'] },
      a: {
        message: {
          author: { role: 'user' },
          content: { content_type: 'text', parts: ['我想做一個解決 AI 失憶症的工具'] },
          create_time: 1720000001,
        },
        children: ['b'],
      },
      b: {
        message: {
          author: { role: 'assistant' },
          content: { content_type: 'text', parts: ['好啊，我建議用蒸餾引擎而不是摘要引擎'] },
          create_time: 1720000002,
        },
        children: [],
      },
    },
  },
  {
    title: '空的對話',
    create_time: 1720000100,
    mapping: { root: { message: null, children: [] } },
  },
  {
    title: '另一個對話',
    create_time: 1720000200,
    mapping: {
      root: { message: null, children: ['x'] },
      x: {
        message: {
          author: { role: 'user' },
          content: { content_type: 'text', parts: ['嗨'] },
          create_time: 1720000201,
        },
        children: ['y'],
      },
      y: {
        message: {
          author: { role: 'assistant' },
          content: { content_type: 'text', parts: ['你好'] },
          create_time: 1720000202,
        },
        children: [],
      },
    },
  },
]

console.log('=== Test 1: ChatGPT 解析 ===')
const r1 = parseChatGptExport(chatgptExport)
console.log('Source:', r1.source)
console.log('Total:', r1.totalConversations)
console.log('Parsed:', r1.parsedCount)
console.log('Skipped:', r1.skippedCount)
console.log('Conversations:')
r1.conversations.forEach((c, i) => {
  console.log(`  ${i + 1}. [${c.source}] ${c.title} (${c.messageCount} msgs, ~${c.tokenEstimate} tok)`)
  console.log(`     Preview: ${c.conversationText.slice(0, 80)}...`)
})

if (r1.conversations.length !== 1) throw new Error('Expected 1 parsed (one valid, one empty, one too short)')
if (r1.skippedCount !== 2) throw new Error('Expected 2 skipped')
if (r1.conversations[0].messageCount !== 2) throw new Error('Expected 2 messages in first conv')
console.log('✓ Test 1 passed\n')

// === Test 2: Claude 格式 ===
const claudeExport = [
  {
    name: 'Claude 設計討論',
    created_at: '2024-07-01T10:00:00Z',
    chat_messages: [
      { sender: 'human', text: '我想做一個解決 AI 跨對話失憶症的記憶工具，可以幫我設計嗎？', created_at: '2024-07-01T10:00:01Z' },
      { sender: 'assistant', text: '好啊，我建議用蒸餾引擎而非摘要引擎。Brain 應該用 8 種知識類型，每次對話做 delta 運算。', created_at: '2024-07-01T10:00:02Z' },
    ],
  },
  {
    name: '短對話',
    created_at: '2024-07-01T11:00:00Z',
    chat_messages: [{ sender: 'human', text: '嗨' }],
  },
]

console.log('=== Test 2: Claude 解析 ===')
const r2 = parseClaudeExport(claudeExport)
console.log('Source:', r2.source)
console.log('Total:', r2.totalConversations)
console.log('Parsed:', r2.parsedCount)
console.log('Skipped:', r2.skippedCount)
r2.conversations.forEach((c, i) => {
  console.log(`  ${i + 1}. [${c.source}] ${c.title} (${c.messageCount} msgs)`)
  console.log(`     Preview: ${c.conversationText.slice(0, 80)}...`)
})

if (r2.conversations.length !== 1) throw new Error('Expected 1 parsed (one valid)')
if (r2.skippedCount !== 1) throw new Error('Expected 1 skipped (too short)')
console.log('✓ Test 2 passed\n')

// === Test 3: 自動偵測 ===
console.log('=== Test 3: 自動偵測格式 ===')
const r3a = parseConversationExport(chatgptExport)
const r3b = parseConversationExport(claudeExport)
if (r3a.source !== 'chatgpt') throw new Error('Expected chatgpt')
if (r3b.source !== 'claude') throw new Error('Expected claude')
console.log('✓ Test 3 passed — auto-detection works\n')

// === Test 4: 錯誤處理 ===
console.log('=== Test 4: 錯誤處理 ===')
try {
  parseConversationExport([])
  throw new Error('Should have thrown')
} catch (e) {
  console.log('✓ Empty array throws:', (e as Error).message)
}

try {
  parseConversationExport([{ weird: 'format' }])
  throw new Error('Should have thrown')
} catch (e) {
  console.log('✓ Unknown format throws:', (e as Error).message)
}

console.log('\n🎉 All tests passed')
