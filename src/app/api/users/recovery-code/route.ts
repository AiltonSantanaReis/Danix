import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { users } from '@/db/schema';
import { generateRecoveryCode, hashSecret, recordAdminEvent, requireAuth } from '../../auth-utils';

export const dynamic = 'force-dynamic';

const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  if (!auth.user.permissions.users && !auth.user.permissions.recoverUsers) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = toId(body.id);

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const found = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = found[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const recoveryCode = generateRecoveryCode();
    await db.update(users).set({
      recoveryCodeHash: hashSecret(recoveryCode),
    }).where(eq(users.id, id));
    await syncDatabaseBackup();
    await recordAdminEvent(auth.user, 'recovery_code_generated', 'user', id, `Codigo de recuperacao gerado para: ${user.username}`);

    return NextResponse.json({ recoveryCode });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate recovery code' }, { status: 500 });
  }
}
