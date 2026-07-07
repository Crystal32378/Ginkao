import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

export function middleware(req: NextRequest) {
  return checkAuth(req)
}

// 只攔截 /api/projects 開頭的請求
export const config = {
  matcher: ['/api/projects/:path*'],
}
