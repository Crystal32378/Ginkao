// 銀杏藥局 Chrome 擴充 — content script
// 注入到 chatgpt.com / claude.ai 頁面中
// 職責：
//   1. 在頁面上注入「🌿 存成藥丸」浮動按鈕
//   2. 點擊時抓取當前對話全文
//   3. 透過 background 呼叫銀杏藥局 API 煉丹
//   4. 完成時顯示 toast
//   5. 開新對話時自動注入當前記憶卡

(() => {
  'use strict'

  // 防止重複注入
  if (window.__ginkgoPharmacyInjected) return
  window.__ginkgoPharmacyInjected = true

  console.log('[銀杏藥局] content script loaded on', location.host)

  // ============ 設定 ============
  const FLOATING_BUTTON_ID = 'ginkgo-floating-button'
  const TOAST_ID = 'ginkgo-toast'

  // ============ Toast UI ============
  function showToast(message, type = 'info', durationMs = 4000) {
    let toast = document.getElementById(TOAST_ID)
    if (!toast) {
      toast = document.createElement('div')
      toast.id = TOAST_ID
      toast.className = 'ginkgo-toast'
      document.body.appendChild(toast)
    }
    toast.className = `ginkgo-toast ginkgo-toast-${type}`
    toast.textContent = message
    toast.classList.add('ginkgo-toast-visible')
    clearTimeout(toast._timeout)
    toast._timeout = setTimeout(() => {
      toast.classList.remove('ginkgo-toast-visible')
    }, durationMs)
  }

  // ============ 浮動按鈕 ============
  function ensureFloatingButton() {
    if (document.getElementById(FLOATING_BUTTON_ID)) return

    const btn = document.createElement('button')
    btn.id = FLOATING_BUTTON_ID
    btn.className = 'ginkgo-floating-btn'
    btn.innerHTML = '🌿'
    btn.title = '銀杏藥局 — 存成記憶藥丸'
    btn.setAttribute('aria-label', '存成銀杏記憶藥丸')

    btn.addEventListener('click', handleSavePill)
    document.body.appendChild(btn)
    console.log('[銀杏藥局] floating button injected')
  }

  // ============ 抓取對話 ============
  function detectPlatform() {
    const host = location.host
    if (/chatgpt\.com|chat\.openai\.com/.test(host)) return 'chatgpt'
    if (/claude\.ai/.test(host)) return 'claude'
    return 'unknown'
  }

  /**
   * 從當前頁面 DOM 抓取對話文本
   * ChatGPT 跟 Claude 的 DOM 結構不同，分開處理
   */
  function extractConversationText() {
    const platform = detectPlatform()
    if (platform === 'chatgpt') return extractChatGPT()
    if (platform === 'claude') return extractClaude()
    return null
  }

  function extractChatGPT() {
    // ChatGPT 的對話訊息在 article[data-testid^="conversation-turn-"] 裡
    // 每個 article 內有 .text-token-text-primary 等元素
    const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"]')
    if (turns.length === 0) return null

    const lines = []
    turns.forEach((turn, idx) => {
      // data-testid="conversation-turn-X" — 偶數 = user, 奇數 = assistant (0-indexed)
      // 但更穩妥是看內部有沒有 [data-message-author-role]
      const roleEl = turn.querySelector('[data-message-author-role]')
      const role = roleEl?.getAttribute('data-message-author-role') || (idx % 2 === 0 ? 'user' : 'assistant')

      // 抓所有可見文字 — .markdown 是主要內容容器
      const contentEl = turn.querySelector('.markdown') || turn.querySelector('[data-message-author-role]')
      const text = contentEl ? contentEl.innerText.trim() : ''
      if (text) {
        lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
      }
    })

    return lines.length > 0 ? lines.join('\n\n') : null
  }

  function extractClaude() {
    // Claude 的對話訊息結構會變動。嘗試多種選擇器。
    // 已知結構：[data-testid="user-message"] 和 .font-claude-message (assistant)
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]')
    const assistantMsgs = document.querySelectorAll('.font-claude-message')

    if (userMsgs.length === 0 && assistantMsgs.length === 0) {
      // Fallback：嘗試更通用的選擇器
      return extractClaudeFallback()
    }

    // 把所有訊息按 DOM 順序合併
    const allMsgs = []
    userMsgs.forEach((el) => allMsgs.push({ el, role: 'user' }))
    assistantMsgs.forEach((el) => allMsgs.push({ el, role: 'assistant' }))
    // 按 DOM 順序排序
    allMsgs.sort((a, b) => {
      if (a.el === b.el) return 0
      const pos = a.el.compareDocumentPosition(b.el)
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })

    const lines = []
    for (const { el, role } of allMsgs) {
      const text = el.innerText.trim()
      if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
    }
    return lines.length > 0 ? lines.join('\n\n') : null
  }

  function extractClaudeFallback() {
    // 嘗試抓 .human-turn / .assistant-turn 等
    const turns = document.querySelectorAll('[data-testid="conversation-turn-"], .human-turn, .assistant-turn')
    if (turns.length === 0) return null
    const lines = []
    turns.forEach((turn, idx) => {
      const role = turn.classList.contains('human-turn') || turn.getAttribute('data-testid')?.includes('human')
        ? 'user'
        : 'assistant'
      const text = turn.innerText.trim()
      if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
    })
    return lines.length > 0 ? lines.join('\n\n') : null
  }

  // ============ 存成藥丸 ============
  async function handleSavePill() {
    const btn = document.getElementById(FLOATING_BUTTON_ID)
    if (btn) {
      btn.classList.add('ginkgo-loading')
      btn.disabled = true
    }
    showToast('🌿 抓取對話中…', 'info', 1500)

    const conversationText = extractConversationText()
    if (!conversationText || conversationText.trim().length < 10) {
      showToast('抓不到對話內容（可能是空白對話，或 DOM 結構變了）', 'error', 5000)
      if (btn) {
        btn.classList.remove('ginkgo-loading')
        btn.disabled = false
      }
      return
    }

    // 取得設定
    const settings = await chrome.storage.sync.get(['apiBaseUrl', 'apiToken', 'projectId'])
    if (!settings.apiBaseUrl || !settings.projectId) {
      showToast('請先點擴充圖示設定 API base URL 與專案 ID', 'error', 5000)
      if (btn) {
        btn.classList.remove('ginkgo-loading')
        btn.disabled = false
      }
      return
    }

    showToast('🔥 煉丹中…（10-30 秒）', 'info', 30000)

    try {
      const url = `${settings.apiBaseUrl.replace(/\/$/, '')}/api/projects/${settings.projectId}/pills`
      const headers = { 'content-type': 'application/json' }
      if (settings.apiToken) {
        headers['authorization'] = `Bearer ${settings.apiToken}`
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ conversationText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      showToast(`🌿 煉丹完成！${data.pill?.title || ''}`.slice(0, 80), 'success', 5000)
    } catch (err) {
      console.error('[銀杏藥局] save failed', err)
      showToast(`煉丹失敗：${err.message || err}`, 'error', 6000)
    } finally {
      if (btn) {
        btn.classList.remove('ginkgo-loading')
        btn.disabled = false
      }
    }
  }

  // ============ 自動注入記憶卡到新對話 ============
  let autoInjectTried = false
  async function tryAutoInject() {
    if (autoInjectTried) return
    autoInjectTried = true

    const settings = await chrome.storage.sync.get(['apiBaseUrl', 'apiToken', 'projectId', 'autoInject'])
    if (!settings.autoInject) return
    if (!settings.apiBaseUrl || !settings.projectId) return

    // 只在新對話頁注入（URL 結尾是 /c/new 或 /g/{id}/c/new 等）
    const url = location.href
    const isNewConversation =
      /\/c\/new/.test(url) ||
      /\/g\/[^/]+\/c\/new/.test(url) ||
      // Claude: chat 介面首頁
      (location.host === 'claude.ai' && (url === 'https://claude.ai/new' || url === 'https://claude.ai/'))

    if (!isNewConversation) return

    // 等 input 出現
    const input = await waitForInput(5000).catch(() => null)
    if (!input) return

    // 撈記憶卡
    try {
      const memUrl = `${settings.apiBaseUrl.replace(/\/$/, '')}/api/projects/${settings.projectId}/memory?format=text`
      const headers = {}
      if (settings.apiToken) {
        headers['authorization'] = `Bearer ${settings.apiToken}`
      }
      const res = await fetch(memUrl, { headers })
      if (!res.ok) return
      const text = await res.text()
      if (!text || text.includes('還沒有記憶藥丸')) return

      // 顯示一個小提示條，讓使用者選擇是否注入
      showInjectPrompt(text)
    } catch (err) {
      console.warn('[銀杏藥局] auto inject failed', err)
    }
  }

  function waitForInput(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const tryFind = () => {
        // ChatGPT: div[contenteditable="true"] 或 textarea
        // Claude: div.ProseMirror 或 div[contenteditable="true"]
        const el =
          document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"]') ||
          document.querySelector('textarea#prompt-textarea') ||
          document.querySelector('div.ProseMirror')
        if (el) return resolve(el)
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'))
        setTimeout(tryFind, 200)
      }
      tryFind()
    })
  }

  function showInjectPrompt(memoryText) {
    const banner = document.createElement('div')
    banner.className = 'ginkgo-inject-banner'
    banner.innerHTML = `
      <div class="ginkgo-inject-icon">🌿</div>
      <div class="ginkgo-inject-text">
        <div class="ginkgo-inject-title">銀杏記憶卡已備好</div>
        <div class="ginkgo-inject-sub">點擊注入到這則對話的第一則訊息</div>
      </div>
      <button class="ginkgo-inject-btn">注入</button>
      <button class="ginkgo-inject-close">×</button>
    `

    const injectBtn = banner.querySelector('.ginkgo-inject-btn')
    const closeBtn = banner.querySelector('.ginkgo-inject-close')

    injectBtn.addEventListener('click', async () => {
      const input = await waitForInput(2000).catch(() => null)
      if (!input) {
        showToast('找不到輸入框', 'error')
        return
      }
      // 把記憶卡填入 input
      setInputText(input, memoryText + '\n\n---\n\n')
      banner.remove()
      showToast('🌿 記憶卡已注入', 'success')
    })
    closeBtn.addEventListener('click', () => banner.remove())

    document.body.appendChild(banner)
    setTimeout(() => banner.classList.add('ginkgo-inject-banner-visible'), 50)
  }

  function setInputText(input, text) {
    // 處理 contenteditable 與 textarea 兩種
    if (input.tagName === 'TEXTAREA') {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    // contenteditable — 直接設 innerText 並觸發 input
    input.focus()
    input.innerText = text
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
  }

  // ============ 啟動 ============
  function init() {
    ensureFloatingButton()
    // 延遲一下再嘗試自動注入，等頁面完全載入
    setTimeout(tryAutoInject, 1500)
  }

  // 等 DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // SPA 路由切換時重新嘗試注入
  let lastUrl = location.href
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      autoInjectTried = false
      setTimeout(tryAutoInject, 1500)
    }
  }).observe(document, { subtree: true, childList: true })
})()
