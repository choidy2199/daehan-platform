import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // / 접속 → /login으로 rewrite
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/login', request.url));
  }
}

export const config = {
  matcher: '/',
};
