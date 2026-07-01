import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { sessions } from '@/db/schema';
import { clearSessionCookie, SESSION_COOKIE, tokenHash } from '../../auth-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
    await syncDatabaseBackup();
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
