import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

export function middleware(req: NextRequest) {
  return checkAuth(req)
}

// 只攔截需要 API token 保護的請求
export const config = {
  matcher: ['/api/projects/:path*', '/api/profile/:path*'],
}
