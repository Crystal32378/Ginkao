// 銀杏藥局 Chrome 擴充 — background service worker
// 目前主要負責跨域 fetch 的中繼（content script 已可直接 fetch，但保留以備未來擴充）

// 安裝時的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('[銀杏藥局] 擴充已安裝')
  // 預設設定
  chrome.storage.sync.get(
    ['apiBaseUrl', 'apiToken', 'projectId', 'autoInject'],
    (result) => {
      const defaults = {}
      if (!result.apiBaseUrl) defaults.apiBaseUrl = ''
      if (!result.apiToken) defaults.apiToken = ''
      if (!result.projectId) defaults.projectId = ''
      if (result.autoInject === undefined) defaults.autoInject = true
      if (Object.keys(defaults).length > 0) {
        chrome.storage.sync.set(defaults)
      }
    },
  )
})

// 點擊擴充圖示時開啟 popup（manifest 已設定 default_popup，這裡只是 fallback）
chrome.action.onClicked?.addListener(() => {
  // 預設會開 popup，這裡不做事
})
