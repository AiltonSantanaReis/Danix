import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { sessions, users } from '@/db/schema';
import {
  generateRecoveryCode,
  hashSecret,
  publicUser,
  recordAdminEvent,
  requireAuth,
  serializePermissions,
} from '../auth-utils';

export const dynamic = 'force-dynamic';

const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const hasAnotherActiveAdmin = async (id: number) => {
  const otherAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.isActive, 1), ne(users.id, id)))
    .limit(1);

  return otherAdmins.length > 0;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;

  if (!auth.user.permissions.users && !auth.user.permissions.recoverUsers) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const allUsers = await db.select().from(users).orderBy(users.username);
  return NextResponse.json(allUsers.map(publicUser));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'users');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const username = toRequiredString(body.username);
    const displayName = toRequiredString(body.displayName) || username;
    const password = toRequiredString(body.password);
    const role = body.role === 'admin' ? 'admin' : 'user';

    if (!username || password.length < 6) {
      return NextResponse.json({ error: 'Username and password with at least 6 characters are required' }, { status: 400 });
    }

    const recoveryCode = generateRecoveryCode();
    const created = await db.insert(users).values({
      username,
      displayName,
      passwordHash: hashSecret(password),
      role,
      permissions: serializePermissions(body.permissions, role),
      recoveryCodeHash: hashSecret(recoveryCode),
      isActive: body.isActive === false ? 0 : 1,
    }).returning();

    await syncDatabaseBackup();
    await recordAdminEvent(auth.user, 'user_created', 'user', created[0].id, `Usuario criado: ${username}`);
    return NextResponse.json({ user: publicUser(created[0]), recoveryCode }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, 'users');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const id = toId(body.id);
    const displayName = toRequiredString(body.displayName);
    const username = toRequiredString(body.username);
    const role = body.role === 'admin' ? 'admin' : 'user';
    const password = toRequiredString(body.password);

    if (!id || !username || !displayName) {
      return NextResponse.json({ error: 'User data is invalid' }, { status: 400 });
    }

    const existingRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const existingUser = existingRows[0];

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const values: Partial<typeof users.$inferInsert> = {
      username,
      displayName,
      role,
      permissions: serializePermissions(body.permissions, role),
      isActive: body.isActive === false ? 0 : 1,
    };

    const wouldRemoveAdminAccess = existingUser.role === 'admin' && existingUser.isActive === 1 && (role !== 'admin' || values.isActive !== 1);
    if (wouldRemoveAdminAccess && !(await hasAnotherActiveAdmin(id))) {
      return NextResponse.json({ error: 'At least one active administrator is required' }, { status: 409 });
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must have at least 6 characters' }, { status: 400 });
      }
      values.passwordHash = hashSecret(password);
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    const updated = await db.update(users).set(values).where(eq(users.id, id)).returning();

    await syncDatabaseBackup();
    await recordAdminEvent(auth.user, 'user_updated', 'user', id, `Usuario atualizado: ${username}`);
    return NextResponse.json(publicUser(updated[0]));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, 'users');
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json({ error: 'You cannot remove your own user' }, { status: 409 });
    }

    const existingRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const existingUser = existingRows[0];

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.role === 'admin' && existingUser.isActive === 1 && !(await hasAnotherActiveAdmin(id))) {
      return NextResponse.json({ error: 'At least one active administrator is required' }, { status: 409 });
    }

    await db.delete(sessions).where(eq(sessions.userId, id));
    const deleted = await db.update(users).set({ isActive: 0 }).where(eq(users.id, id)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    await recordAdminEvent(auth.user, 'user_deactivated', 'user', id, `Usuario desativado: ${existingUser.username}`);
    return NextResponse.json({ success: true, deactivated: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
