// 銀杏藥局 Chrome 擴充 popup 邏輯

const form = document.getElementById('settings-form')
const status = document.getElementById('status')
const result = document.getElementById('result')
const apiBaseUrlInput = document.getElementById('apiBaseUrl')
const apiTokenInput = document.getElementById('apiToken')
const projectIdInput = document.getElementById('projectId')
const projectSelect = document.getElementById('projectSelect')
const autoInjectInput = document.getElementById('autoInject')
const fetchProjectsBtn = document.getElementById('fetchProjects')
const testBtn = document.getElementById('testBtn')
const openAppLink = document.getElementById('openApp')

// 載入已儲存的設定
chrome.storage.sync.get(['apiBaseUrl', 'apiToken', 'projectId', 'autoInject'], (data) => {
  apiBaseUrlInput.value = data.apiBaseUrl || ''
  apiTokenInput.value = data.apiToken || ''
  projectIdInput.value = data.projectId || ''
  autoInjectInput.checked = data.autoInject !== false // 預設 true
  status.classList.add('hidden')
  form.classList.remove('hidden')
})

// 儲存設定
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = {
    apiBaseUrl: apiBaseUrlInput.value.trim().replace(/\/$/, ''),
    apiToken: apiTokenInput.value.trim(),
    projectId: projectIdInput.value.trim(),
    autoInject: autoInjectInput.checked,
  }
  chrome.storage.sync.set(data, () => {
    showResult('設定已儲存 ✓', 'success')
  })
})

// 測試連線
testBtn.addEventListener('click', async () => {
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, '')
  const token = apiTokenInput.value.trim()
  const projectId = projectIdInput.value.trim()

  if (!baseUrl) {
    showResult('請先填 API Base URL', 'error')
    return
  }
  if (!projectId) {
    showResult('請先填專案 ID', 'error')
    return
  }

  showResult('測試中…')
  try {
    const url = `${baseUrl}/api/projects/${projectId}/memory`
    const headers = {}
    if (token) headers['authorization'] = `Bearer ${token}`
    const res = await fetch(url, { headers })
    if (res.status === 401) {
      throw new Error('401 Unauthorized — token 不對或 server 有設 token 但你沒填')
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const data = await res.json()
    const mem = data.memory || {}
    const count =
      (mem.decisions?.length || 0) +
      (mem.openQuestions?.length || 0) +
      (mem.actionItems?.length || 0) +
      (mem.contextAnchors?.length || 0)
    showResult(
      `連線成功 ✓\n專案：${data.project?.name || '?'}\n當前藥丸：${data.pill?.title || '(無)'}\n記憶條目：${count}`,
      'success',
    )
  } catch (err) {
    showResult(`連線失敗：${err.message || err}`, 'error')
  }
})

// 撈專案列表
fetchProjectsBtn.addEventListener('click', async () => {
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, '')
  const token = apiTokenInput.value.trim()

  if (!baseUrl) {
    showResult('請先填 API Base URL', 'error')
    return
  }

  showResult('撈專案列表中…')
  try {
    const headers = {}
    if (token) headers['authorization'] = `Bearer ${token}`
    const res = await fetch(`${baseUrl}/api/projects`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const projects = data.projects || []

    if (projects.length === 0) {
      showResult('沒有任何專案，請先到銀杏藥局 UI 建立', 'error')
      return
    }

    // 填入 select
    projectSelect.innerHTML = '<option value="">— 選擇專案 —</option>'
    projects.forEach((p) => {
      const opt = document.createElement('option')
      opt.value = p.id
      opt.textContent = `${p.emoji || '🌿'} ${p.name} (${p._count?.pills || 0} 顆)`
      projectSelect.appendChild(opt)
    })
    projectSelect.classList.remove('hidden')

    // 如果當前 projectId 在列表中，預選它
    if (projectIdInput.value) {
      projectSelect.value = projectIdInput.value
    }

    showResult(`撈到 ${projects.length} 個專案，請從下拉選單選擇`, 'success')
  } catch (err) {
    showResult(`撈專案失敗：${err.message || err}`, 'error')
  }
})

projectSelect.addEventListener('change', () => {
  projectIdInput.value = projectSelect.value
})

// 開啟銀杏藥局
openAppLink.addEventListener('click', (e) => {
  e.preventDefault()
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, '')
  if (baseUrl) {
    chrome.tabs.create({ url: baseUrl })
  } else {
    chrome.tabs.create({ url: 'https://preview-z-bot-id.space-z.ai/' })
  }
})

function showResult(msg, type) {
  result.textContent = msg
  result.className = 'result' + (type ? ` ${type}` : '')
  result.classList.remove('hidden')
}
