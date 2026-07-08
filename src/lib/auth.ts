import { NextRequest, NextResponse } from 'next/server'

/**
 * Ginkgo API 認證
 *
 * 設計：
 * - 環境變數 GINKGO_API_TOKEN 留空 → 不檢查（local 自用模式）
 * - 設置了 → 所有 /api/projects/** 必須帶 Authorization: Bearer <token>
 *
 * 例外路徑（永遠公開）：
 * - GET /api/health — 健康檢查
 *
 * 網頁 UI（同源瀏覽器請求）自動放行 — 因為 UI 跑在同個 origin，token 不會外洩
 * 我們用 Sec-Fetch-Site header 判斷是否為 same-origin 瀏覽器請求
 */

const PROTECTED_PREFIX = '/api/projects'
const PUBLIC_PATHS = new Set(['/api/health', '/api/import-url'])

export function checkAuth(req: NextRequest): NextResponse | null {
  const token = process.env.GINKGO_API_TOKEN
  // 沒設 token → 完全不檢查
  if (!token) return null

  const path = req.nextUrl.pathname

  // 公開路徑放行
  if (PUBLIC_PATHS.has(path)) return null

  // 不是受保護前綴 → 放行（讓 middleware 機制自己處理）
  if (!path.startsWith(PROTECTED_PREFIX)) return null

  // Same-origin 瀏覽器請求放行（網頁 UI 不需要 token）
  // Sec-Fetch-Site: same-origin 表示來自同源頁面的 fetch
  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite === 'same-origin') return null

  // 檢查 Authorization header
  const auth = req.headers.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return NextResponse.json(
      { error: 'Missing Authorization header. Expected: Bearer <token>' },
      { status: 401 },
    )
  }
  if (match[1].trim() !== token) {
    return NextResponse.json(
      { error: 'Invalid API token' },
      { status: 401 },
    )
  }

  return null
}
