// Ginkgo Chrome 擴充 popup 邏輯 v0.2

const form = document.getElementById('settings-form')
const status = document.getElementById('status')
const result = document.getElementById('result')
const apiBaseUrlInput = document.getElementById('apiBaseUrl')
const apiTokenInput = document.getElementById('apiToken')
const projectIdInput = document.getElementById('projectId')
const projectSelect = document.getElementById('projectSelect')
const reminderThresholdInput = document.getElementById('reminderThreshold')
const amnesiaDetectionInput = document.getElementById('amnesiaDetection')
const autoInjectInput = document.getElementById('autoInject')
const fetchProjectsBtn = document.getElementById('fetchProjects')
const testBtn = document.getElementById('testBtn')
const openAppLink = document.getElementById('openApp')

// 載入已儲存的設定
chrome.storage.sync.get(
  ['apiBaseUrl', 'apiToken', 'projectId', 'reminderThreshold', 'amnesiaDetection', 'autoInject'],
  (data) => {
    apiBaseUrlInput.value = data.apiBaseUrl || ''
    apiTokenInput.value = data.apiToken || ''
    projectIdInput.value = data.projectId || ''
    reminderThresholdInput.value = data.reminderThreshold ?? 15
    amnesiaDetectionInput.checked = data.amnesiaDetection !== false // 預設 true
    autoInjectInput.checked = data.autoInject !== false // 預設 true
    status.classList.add('hidden')
    form.classList.remove('hidden')
  },
)

// 儲存設定
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const threshold = parseInt(reminderThresholdInput.value, 10)
  if (isNaN(threshold) || threshold < 3 || threshold > 100) {
    showResult('訊息數 threshold 必須在 3-100 之間', 'error')
    return
  }
  const data = {
    apiBaseUrl: apiBaseUrlInput.value.trim().replace(/\/$/, ''),
    apiToken: apiTokenInput.value.trim(),
    projectId: projectIdInput.value.trim(),
    reminderThreshold: threshold,
    amnesiaDetection: amnesiaDetectionInput.checked,
    autoInject: autoInjectInput.checked,
  }
  chrome.storage.sync.set(data, () => {
    showResult('設定已儲存 ✓\n提醒會在下次對話更新時生效', 'success')
  })
})

// 測試連線 — 改用 /brain 端點
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
    const url = `${baseUrl}/api/projects/${projectId}/brain`
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
    const activeCount = data.activeCount ?? data.items?.length ?? 0
    showResult(
      `連線成功 ✓\n專案：${data.project?.name || '?'}\nBrain 版本：v${(data.brainVersion ?? 0).toFixed(2)}\n知識條目：${activeCount} active`,
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
      showResult('沒有任何專案，請先到 Ginkgo UI 建立', 'error')
      return
    }

    projectSelect.innerHTML = '<option value="">— 選擇專案 —</option>'
    projects.forEach((p) => {
      const opt = document.createElement('option')
      opt.value = p.id
      const itemCount = p._count?.knowledgeItems ?? 0
      const pillCount = p._count?.pills ?? 0
      opt.textContent = `${p.emoji || '🌿'} ${p.name} (Brain v${(p.brainVersion ?? 0).toFixed(2)}, ${itemCount} 知識, ${pillCount} 對話)`
      projectSelect.appendChild(opt)
    })
    projectSelect.classList.remove('hidden')

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

// 開啟 Ginkgo
openAppLink.addEventListener('click', (e) => {
  e.preventDefault()
  const baseUrl = apiBaseUrlInput.value.trim().replace(/\/$/, '')
  if (baseUrl) {
    chrome.tabs.create({ url: baseUrl })
  } else {
    chrome.tabs.create({ url: 'https://github.com/Crystal32378/Ginkgo' })
  }
})

function showResult(msg, type) {
  result.textContent = msg
  result.className = 'result' + (type ? ` ${type}` : '')
  result.classList.remove('hidden')
}
