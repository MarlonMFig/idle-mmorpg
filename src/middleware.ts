import { shouldUseSupabase } from '@/lib/auth/local-runtime';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  if (!shouldUseSupabase()) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|tmx|json)$).*)',
  ],
};
