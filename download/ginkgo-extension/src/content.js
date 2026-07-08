// Ginkgo Chrome 擴充 — content script v0.2
//
// v0.2 變更：
//   1. 按鈕優先注入到對話輸入框 toolbar（送出鈕左邊），fallback 才用浮動
//   2. 加「該 Ginkgo 了」提醒：
//      - Trigger #1: 訊息數 > threshold（預設 15）→ 按鈕 pulsing badge + 一次 toast
//      - Trigger #2: 失憶偵測（輕量個測）— 掃最近 3 則 AI 回覆有沒有「重解釋」pattern
//   3. SPA 路由切換時重新注入 + 重置提醒狀態

(() => {
  'use strict'

  if (window.__ginkgoInjected) return
  window.__ginkgoInjected = true

  console.log('[Ginkgo] content script v0.2 loaded on', location.host)

  // ============ Constants ============
  const INLINE_BUTTON_ID = 'ginkgo-inline-btn'
  const FLOATING_BUTTON_ID = 'ginkgo-floating-btn'
  const TOAST_ID = 'ginkgo-toast'
  const BADGE_CLASS = 'ginkgo-badge'

  // 失憶偵測 regex（輕量、無 LLM call）
  // 這些 pattern 出現代表 AI 在「重解釋」— 強烈失憶訊號
  const AMNESIA_PATTERNS = [
    // 英文
    /\bas (i|we) (mentioned|said|explained|noted|discussed)\b/i,
    /\blet me (explain|recap|clarify|summarize|re-explain)\b/i,
    /\bfor (context|background|reference),\b/i,
    /\bto (recap|reiterate|summarize),\b/i,
    /\bpreviously,?\s+(i|we)\b/i,
    /\bi already (told|mentioned|explained)\b/i,
    // 中文
    /(如前所述|前面提過|之前說過|我剛剛說過|我們之前討論過)/,
    /(讓我(再)?(解釋|說明|補充)一下)/,
    /(為了(上下文|背景)(一致性)?)/,
    /(簡單(說|講)一下)/,
    /(我已經(說過|提過|解釋過))/,
  ]

  // ============ State ============
  let currentInlineButton = null
  let currentFloatingButton = null
  let lastReminderUrl = null  // 每個 conversation URL 只提醒一次
  let lastMessageCount = 0

  // ============ Toast ============
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

  // ============ Platform detection ============
  function detectPlatform() {
    const host = location.host
    if (/chatgpt\.com|chat\.openai\.com/.test(host)) return 'chatgpt'
    if (/claude\.ai/.test(host)) return 'claude'
    return 'unknown'
  }

  // ============ 找送出按鈕（用於 inline 注入） ============
  function findSendButton() {
    const platform = detectPlatform()
    if (platform === 'chatgpt') {
      // ChatGPT 送出鈕：data-testid="send-button"
      return document.querySelector('button[data-testid="send-button"]')
    }
    if (platform === 'claude') {
      // Claude 送出鈕：aria-label="Send Message" 或 type="submit" 在 composer form 內
      return (
        document.querySelector('button[aria-label="Send Message"]') ||
        document.querySelector('button[aria-label*="Send" i]') ||
        document.querySelector('composer form button[type="submit"]') ||
        document.querySelector('form button[type="submit"]')
      )
    }
    return null
  }

  // ============ Inline button 注入 ============
  function ensureInlineButton() {
    // 已注入且還在 DOM 中
    if (currentInlineButton && document.contains(currentInlineButton)) return true

    const sendBtn = findSendButton()
    if (!sendBtn) {
      // 找不到送出鈕 — fallback 到浮動按鈕
      ensureFloatingButton()
      return false
    }

    // 移除舊的浮動按鈕（如果有的話）
    removeFloatingButton()

    // 建立 inline 按鈕
    const btn = document.createElement('button')
    btn.id = INLINE_BUTTON_ID
    btn.className = 'ginkgo-inline-btn'
    btn.innerHTML = '🌿'
    btn.type = 'button'  // 避免觸發 form submit
    btn.title = 'Ginkgo — 蒸餾這段對話'
    btn.setAttribute('aria-label', 'Ginkgo 蒸餾這段對話')
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleSavePill()
    })

    // 插到 sendBtn 前面（左邊）
    sendBtn.parentNode.insertBefore(btn, sendBtn)
    currentInlineButton = btn
    // 同時移除浮動按鈕（如果還在）
    removeFloatingButton()
    console.log('[Ginkgo] inline button injected next to send button')
    return true
  }

  function removeInlineButton() {
    if (currentInlineButton && currentInlineButton.parentNode) {
      currentInlineButton.parentNode.removeChild(currentInlineButton)
    }
    currentInlineButton = null
  }

  // ============ Floating button（fallback） ============
  function ensureFloatingButton() {
    if (currentFloatingButton && document.contains(currentFloatingButton)) return

    const btn = document.createElement('button')
    btn.id = FLOATING_BUTTON_ID
    btn.className = 'ginkgo-floating-btn'
    btn.innerHTML = '🌿'
    btn.title = 'Ginkgo — 蒸餾這段對話'
    btn.setAttribute('aria-label', 'Ginkgo 蒸餾這段對話')
    btn.addEventListener('click', handleSavePill)
    document.body.appendChild(btn)
    currentFloatingButton = btn
    console.log('[Ginkgo] floating button injected (fallback)')
  }

  function removeFloatingButton() {
    if (currentFloatingButton && currentFloatingButton.parentNode) {
      currentFloatingButton.parentNode.removeChild(currentFloatingButton)
    }
    currentFloatingButton = null
  }

  // ============ Badge（提醒指示） ============
  function ensureBadge(buttonEl) {
    if (!buttonEl) return
    if (buttonEl.querySelector('.' + BADGE_CLASS)) return
    const badge = document.createElement('span')
    badge.className = BADGE_CLASS
    badge.textContent = '!'
    buttonEl.appendChild(badge)
    buttonEl.classList.add('ginkgo-pulse')
  }

  function removeBadge(buttonEl) {
    if (!buttonEl) return
    const badge = buttonEl.querySelector('.' + BADGE_CLASS)
    if (badge) badge.remove()
    buttonEl.classList.remove('ginkgo-pulse')
  }

  function getActiveButton() {
    return currentInlineButton || currentFloatingButton
  }

  // ============ 抓取對話 ============
  function extractConversationText() {
    const platform = detectPlatform()
    if (platform === 'chatgpt') return extractChatGPT()
    if (platform === 'claude') return extractClaude()
    return null
  }

  function extractChatGPT() {
    const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"]')
    if (turns.length === 0) return null

    const lines = []
    turns.forEach((turn, idx) => {
      const roleEl = turn.querySelector('[data-message-author-role]')
      const role = roleEl?.getAttribute('data-message-author-role') || (idx % 2 === 0 ? 'user' : 'assistant')
      const contentEl = turn.querySelector('.markdown') || turn.querySelector('[data-message-author-role]')
      const text = contentEl ? contentEl.innerText.trim() : ''
      if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
    })
    return lines.length > 0 ? lines.join('\n\n') : null
  }

  function extractClaude() {
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]')
    const assistantMsgs = document.querySelectorAll('.font-claude-message')

    if (userMsgs.length === 0 && assistantMsgs.length === 0) {
      return extractClaudeFallback()
    }

    const allMsgs = []
    userMsgs.forEach((el) => allMsgs.push({ el, role: 'user' }))
    assistantMsgs.forEach((el) => allMsgs.push({ el, role: 'assistant' }))
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
    const turns = document.querySelectorAll('[data-testid="conversation-turn-"], .human-turn, .assistant-turn')
    if (turns.length === 0) return null
    const lines = []
    turns.forEach((turn, idx) => {
      const role =
        turn.classList.contains('human-turn') || turn.getAttribute('data-testid')?.includes('human')
          ? 'user'
          : 'assistant'
      const text = turn.innerText.trim()
      if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`)
    })
    return lines.length > 0 ? lines.join('\n\n') : null
  }

  // ============ 訊息計數 ============
  function countMessages() {
    const platform = detectPlatform()
    if (platform === 'chatgpt') {
      return document.querySelectorAll('article[data-testid^="conversation-turn-"]').length
    }
    if (platform === 'claude') {
      const userMsgs = document.querySelectorAll('[data-testid="user-message"]').length
      const assistantMsgs = document.querySelectorAll('.font-claude-message').length
      return userMsgs + assistantMsgs
    }
    return 0
  }

  // ============ 失憶偵測（輕量個測） ============
  function detectAmnesia() {
    const platform = detectPlatform()
    let recentAssistantTexts = []

    if (platform === 'chatgpt') {
      const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"]')
      const all = Array.from(turns)
      // 取最後 3 則 assistant 回覆
      const assistantTurns = all.filter((t) => {
        const role = t.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role')
        return role === 'assistant'
      })
      recentAssistantTexts = assistantTurns.slice(-3).map((t) => {
        const el = t.querySelector('.markdown') || t
        return el?.innerText || ''
      })
    } else if (platform === 'claude') {
      const all = Array.from(document.querySelectorAll('.font-claude-message'))
      recentAssistantTexts = all.slice(-3).map((el) => el.innerText || '')
    }

    if (recentAssistantTexts.length === 0) return false

    for (const text of recentAssistantTexts) {
      for (const pattern of AMNESIA_PATTERNS) {
        if (pattern.test(text)) return true
      }
    }
    return false
  }

  // ============ 提醒檢查 ============
  async function checkReminder() {
    const settings = await chrome.storage.sync.get([
      'reminderThreshold',
      'amnesiaDetection',
      'apiBaseUrl',
      'apiToken',
      'projectId',
    ])

    // 沒設 API base 就不提醒（沒設定好也沒用）
    if (!settings.apiBaseUrl || !settings.projectId) return

    const threshold = settings.reminderThreshold ?? 15
    const amnesiaOn = settings.amnesiaDetection !== false  // 預設 true
    const count = countMessages()

    // 訊息數變少代表換對話了 — 重置提醒狀態
    if (count < lastMessageCount - 5) {
      lastReminderUrl = null
    }
    lastMessageCount = count

    const btn = getActiveButton()
    if (!btn) return

    const amnesiaDetected = amnesiaOn ? detectAmnesia() : false
    const shouldRemind = count >= threshold || amnesiaDetected

    if (shouldRemind) {
      ensureBadge(btn)
      // 每個 conversation URL 只 toast 一次
      const urlKey = location.pathname
      if (lastReminderUrl !== urlKey) {
        lastReminderUrl = urlKey
        if (amnesiaDetected) {
          showToast('🌿 偵測到 AI 失憶症狀 — 它在重新解釋已經講過的事。該 Ginkgo 了！', 'warn', 7000)
        } else {
          showToast(`🌿 對話已經 ${count} 則了，該 Ginkgo 一下讓 Brain 演化`, 'info', 6000)
        }
      }
    } else {
      removeBadge(btn)
    }
  }

  // ============ 存成 Brain（蒸餾） ============
  async function handleSavePill() {
    const btn = getActiveButton()
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

    const settings = await chrome.storage.sync.get(['apiBaseUrl', 'apiToken', 'projectId'])
    if (!settings.apiBaseUrl || !settings.projectId) {
      showToast('請先點擴充圖示設定 API base URL 與專案 ID', 'error', 5000)
      if (btn) {
        btn.classList.remove('ginkgo-loading')
        btn.disabled = false
      }
      return
    }

    showToast('🔥 Ginkgo 中…（10-30 秒）', 'info', 30000)

    try {
      const url = `${settings.apiBaseUrl.replace(/\/$/, '')}/api/projects/${settings.projectId}/distill`
      const headers = { 'content-type': 'application/json' }
      if (settings.apiToken) headers['authorization'] = `Bearer ${settings.apiToken}`
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
      // Ginkgo 完成後重置提醒
      lastReminderUrl = location.pathname
      removeBadge(btn)
      const summary = `+${data.delta?.add?.length || 0} ~${data.delta?.update?.length || 0} -${data.delta?.retire?.length || 0}`
      showToast(`🌿 Ginkgo 完成 · Brain v${data.brainVersionAfter?.toFixed(2)} · ${summary}`, 'success', 5000)
    } catch (err) {
      console.error('[Ginkgo] save failed', err)
      showToast(`Ginkgo 失敗：${err.message || err}`, 'error', 6000)
    } finally {
      if (btn) {
        btn.classList.remove('ginkgo-loading')
        btn.disabled = false
      }
    }
  }

  // ============ 自動注入 Brain 到新對話 ============
  let autoInjectTried = false
  async function tryAutoInject() {
    if (autoInjectTried) return
    autoInjectTried = true

    const settings = await chrome.storage.sync.get([
      'apiBaseUrl',
      'apiToken',
      'projectId',
      'autoInject',
    ])
    if (!settings.autoInject) return
    if (!settings.apiBaseUrl || !settings.projectId) return

    const url = location.href
    const isNewConversation =
      /\/c\/new/.test(url) ||
      /\/g\/[^/]+\/c\/new/.test(url) ||
      (location.host === 'claude.ai' && (url === 'https://claude.ai/new' || url === 'https://claude.ai/'))

    if (!isNewConversation) return

    const input = await waitForInput(5000).catch(() => null)
    if (!input) return

    try {
      const memUrl = `${settings.apiBaseUrl.replace(/\/$/, '')}/api/projects/${settings.projectId}/brain?format=protocol`
      const headers = {}
      if (settings.apiToken) headers['authorization'] = `Bearer ${settings.apiToken}`
      const res = await fetch(memUrl, { headers })
      if (!res.ok) return
      const text = await res.text()
      if (!text || text.includes('Brain is empty')) return

      showInjectPrompt(text)
    } catch (err) {
      console.warn('[Ginkgo] auto inject failed', err)
    }
  }

  function waitForInput(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const tryFind = () => {
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
        <div class="ginkgo-inject-title">Ginkgo Brain 已備好</div>
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
      setInputText(input, memoryText + '\n\n---\n\n')
      banner.remove()
      showToast('🌿 Brain 已注入', 'success')
    })
    closeBtn.addEventListener('click', () => banner.remove())

    document.body.appendChild(banner)
    setTimeout(() => banner.classList.add('ginkgo-inject-banner-visible'), 50)
  }

  function setInputText(input, text) {
    if (input.tagName === 'TEXTAREA') {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    input.focus()
    input.innerText = text
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
  }

  // ============ 啟動 ============
  function init() {
    // 嘗試 inline 注入；若失敗 fallback 會在 ensureInlineButton 內自動呼叫
    ensureInlineButton()
    setTimeout(tryAutoInject, 1500)
    setTimeout(checkReminder, 3000)  // 啟動後 3 秒檢查一次
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // SPA 路由切換 — 重新注入 + 重置提醒
  let lastUrl = location.href
  let reinitTimer = null

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      autoInjectTried = false
      lastReminderUrl = null
      lastMessageCount = 0
      // 延遲一下再重新注入（等新頁面 DOM 穩定）
      clearTimeout(reinitTimer)
      reinitTimer = setTimeout(() => {
        removeInlineButton()
        removeFloatingButton()
        ensureInlineButton()
        tryAutoInject()
        setTimeout(checkReminder, 2000)
      }, 800)
    } else {
      // 同一頁面 DOM 變化（例如送出訊息後）— 檢查按鈕還在不在 + 提醒
      if (!currentInlineButton && !currentFloatingButton) {
        ensureInlineButton()
      } else if (currentInlineButton && !document.contains(currentInlineButton)) {
        // 按鈕被 ChatGPT re-render 吃掉了，重新注入
        currentInlineButton = null
        ensureInlineButton()
      }
    }
  }).observe(document, { subtree: true, childList: true })

  // 定期檢查提醒（每 20 秒）
  setInterval(checkReminder, 20000)
})()
