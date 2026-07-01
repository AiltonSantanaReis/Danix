import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { employees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { canViewAllData, ownedIdWhere, requireAuth } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['active', 'inactive']);
const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const toOptionalString = (value: unknown) => {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  return stringValue || null;
};
const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const parsePayload = (body: Record<string, unknown>) => {
  const name = toRequiredString(body.name);
  const status = toRequiredString(body.status) || 'active';
  if (!name || !VALID_STATUSES.has(status)) return null;
  return {
    name,
    role: toOptionalString(body.role),
    phone: toOptionalString(body.phone),
    email: toOptionalString(body.email),
    document: toOptionalString(body.document),
    status,
    notes: toOptionalString(body.notes),
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'employees');
    if ('error' in auth) return auth.error;
    const data = canViewAllData(auth.user)
      ? await db.select().from(employees).orderBy(employees.name)
      : await db.select().from(employees).where(eq(employees.ownerUserId, auth.user.id)).orderBy(employees.name);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'employees');
    if ('error' in auth) return auth.error;
    const payload = parsePayload(await request.json());
    if (!payload) return NextResponse.json({ error: 'Employee data is invalid' }, { status: 400 });
    const created = await db.insert(employees).values({ ...payload, ownerUserId: auth.user.id }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'employees');
    if ('error' in auth) return auth.error;
    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePayload(body);
    if (!id || !payload) return NextResponse.json({ error: 'Employee data is invalid' }, { status: 400 });
    const updated = await db.update(employees).set(payload).where(ownedIdWhere(auth.user, employees.id, id, employees.ownerUserId)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'employees');
    if ('error' in auth) return auth.error;
    const id = toId(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const deleted = await db.delete(employees).where(ownedIdWhere(auth.user, employees.id, id, employees.ownerUserId)).returning();
    if (!deleted[0]) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
