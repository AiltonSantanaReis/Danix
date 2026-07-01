import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { sessions, users } from '@/db/schema';
import { getCurrentUser, hashSecret, recordAdminEvent, verifySecret } from '../../auth-utils';
import { toRequiredString } from '../../validation';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = toRequiredString(body.currentPassword);
    const newPassword = toRequiredString(body.newPassword);

    if (!currentPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password data is invalid' }, { status: 400 });
    }

    const found = await db.select().from(users).where(eq(users.id, currentUser.id)).limit(1);
    const user = found[0];

    if (!user || !verifySecret(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is invalid' }, { status: 401 });
    }

    await db.update(users).set({ passwordHash: hashSecret(newPassword) }).where(eq(users.id, currentUser.id));
    await db.delete(sessions).where(eq(sessions.userId, currentUser.id));
    await recordAdminEvent(currentUser, 'password_changed', 'user', currentUser.id, 'Usuario alterou a propria senha');
    await syncDatabaseBackup();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
