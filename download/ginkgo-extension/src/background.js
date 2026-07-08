// Ginkgo Chrome 擴充 — background service worker v0.2

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Ginkgo] 擴充已安裝/更新')
  chrome.storage.sync.get(
    ['apiBaseUrl', 'apiToken', 'projectId', 'autoInject', 'reminderThreshold', 'amnesiaDetection'],
    (result) => {
      const defaults = {}
      if (!result.apiBaseUrl) defaults.apiBaseUrl = ''
      if (!result.apiToken) defaults.apiToken = ''
      if (!result.projectId) defaults.projectId = ''
      if (result.autoInject === undefined) defaults.autoInject = true
      if (result.reminderThreshold === undefined) defaults.reminderThreshold = 15
      if (result.amnesiaDetection === undefined) defaults.amnesiaDetection = true
      if (Object.keys(defaults).length > 0) {
        chrome.storage.sync.set(defaults)
      }
    },
  )
})
