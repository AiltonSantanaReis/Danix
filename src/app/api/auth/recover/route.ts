import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { sessions, users } from '@/db/schema';
import { hashSecret, verifySecret } from '../../auth-utils';

export const dynamic = 'force-dynamic';

const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = toRequiredString(body.username);
    const recoveryCode = toRequiredString(body.recoveryCode).toUpperCase();
    const newPassword = toRequiredString(body.newPassword);

    if (!username || !recoveryCode || newPassword.length < 6) {
      return NextResponse.json({ error: 'Recovery data is invalid' }, { status: 400 });
    }

    const found = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = found[0];

    if (!user || !user.recoveryCodeHash || !verifySecret(recoveryCode, user.recoveryCodeHash)) {
      return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 });
    }

    await db.update(users).set({
      passwordHash: hashSecret(newPassword),
      isActive: 1,
      recoveryCodeHash: null,
    }).where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await syncDatabaseBackup();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to recover account' }, { status: 500 });
  }
}
