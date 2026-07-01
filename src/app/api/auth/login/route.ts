import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession, publicUser, setSessionCookie, verifySecret } from '../../auth-utils';
import { toRequiredString } from '../../validation';

export const dynamic = 'force-dynamic';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;
const failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

const getLoginKey = (username: string) => username.toLowerCase();

const isTemporarilyLocked = (username: string) => {
  const attempt = failedLoginAttempts.get(getLoginKey(username));
  if (!attempt?.lockedUntil) return false;
  if (attempt.lockedUntil <= Date.now()) {
    failedLoginAttempts.delete(getLoginKey(username));
    return false;
  }
  return true;
};

const registerFailedLogin = (username: string) => {
  const key = getLoginKey(username);
  const current = failedLoginAttempts.get(key) ?? { count: 0 };
  const nextCount = current.count + 1;
  failedLoginAttempts.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : current.lockedUntil,
  });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = toRequiredString(body.username);
    const password = toRequiredString(body.password);

    if (isTemporarilyLocked(username)) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 });
    }

    const found = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = found[0];

    if (!user || user.isActive !== 1 || !verifySecret(password, user.passwordHash)) {
      registerFailedLogin(username);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    failedLoginAttempts.delete(getLoginKey(username));
    const session = await createSession(user.id);
    const response = NextResponse.json({ user: publicUser(user) });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
