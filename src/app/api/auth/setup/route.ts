import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { budgets, employees, expenses, invoices, payables, properties, receivables, sales, suppliers, users } from '@/db/schema';
import {
  createSession,
  generateRecoveryCode,
  getUserCount,
  hashSecret,
  recordAdminEvent,
  serializePermissions,
  setSessionCookie,
} from '../../auth-utils';

export const dynamic = 'force-dynamic';

const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function POST(request: NextRequest) {
  try {
    if (await getUserCount()) {
      return NextResponse.json({ error: 'Setup already completed' }, { status: 409 });
    }

    const body = await request.json();
    const username = toRequiredString(body.username);
    const displayName = toRequiredString(body.displayName) || username;
    const password = toRequiredString(body.password);

    if (!username || password.length < 6) {
      return NextResponse.json({ error: 'Username and password with at least 6 characters are required' }, { status: 400 });
    }

    const recoveryCode = generateRecoveryCode();
    const created = await db.insert(users).values({
      username,
      displayName,
      passwordHash: hashSecret(password),
      role: 'admin',
      permissions: serializePermissions({}, 'admin'),
      recoveryCodeHash: hashSecret(recoveryCode),
      isActive: 1,
    }).returning();

    const admin = created[0];
    await db.update(properties).set({ ownerUserId: admin.id });
    await db.update(expenses).set({ ownerUserId: admin.id });
    await db.update(sales).set({ ownerUserId: admin.id });
    await db.update(suppliers).set({ ownerUserId: admin.id });
    await db.update(payables).set({ ownerUserId: admin.id });
    await db.update(invoices).set({ ownerUserId: admin.id });
    await db.update(employees).set({ ownerUserId: admin.id });
    await db.update(receivables).set({ ownerUserId: admin.id });
    await db.update(budgets).set({ ownerUserId: admin.id });

    const session = await createSession(admin.id);
    await syncDatabaseBackup();
    await recordAdminEvent({ id: admin.id, username: admin.username }, 'initial_admin_created', 'user', admin.id, 'Primeiro administrador criado');

    const response = NextResponse.json({ success: true, recoveryCode });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to complete setup' }, { status: 500 });
  }
}
