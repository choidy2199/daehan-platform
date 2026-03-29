import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // / 접속 → /manager/index.html 내부 rewrite (URL은 / 유지)
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/manager/index.html', request.url));
  }
}

export const config = {
  matcher: '/',
};
