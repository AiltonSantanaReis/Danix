import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { properties, receivables } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth, type AuthUser } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['open', 'received', 'overdue', 'canceled']);
const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const toOptionalString = (value: unknown) => {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  return stringValue || null;
};
const toRequiredNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};
const toOptionalId = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};
const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const resolveOwnerForProperty = async (user: AuthUser, propertyId: number | null) => {
  if (!propertyId) return user.id;
  const found = await db
    .select({ ownerUserId: properties.ownerUserId })
    .from(properties)
    .where(ownedIdWhere(user, properties.id, propertyId, properties.ownerUserId))
    .limit(1);
  if (!found[0]) return null;
  return found[0].ownerUserId ?? user.id;
};

const parsePayload = (body: Record<string, unknown>) => {
  const description = toRequiredString(body.description);
  const amount = toRequiredNumber(body.amount);
  const issueDate = toOptionalString(body.issueDate);
  const dueDate = toRequiredString(body.dueDate);
  const receivedDate = toOptionalString(body.receivedDate);
  const status = toRequiredString(body.status) || 'open';

  if (!description || amount === null || !isValidDateString(issueDate) || !isValidDateString(dueDate) || !isValidDateString(receivedDate) || !VALID_STATUSES.has(status)) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    clientName: toOptionalString(body.clientName),
    description,
    amount,
    issueDate,
    dueDate,
    receivedDate,
    status,
    paymentMethod: toOptionalString(body.paymentMethod),
    observation: toOptionalString(body.observation),
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'receivables');
    if ('error' in auth) return auth.error;
    const data = canViewAllData(auth.user)
      ? await db.select().from(receivables).orderBy(receivables.dueDate)
      : await db.select().from(receivables).where(eq(receivables.ownerUserId, auth.user.id)).orderBy(receivables.dueDate);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch receivables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'receivables');
    if ('error' in auth) return auth.error;
    const payload = parsePayload(await request.json());
    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;
    if (!payload || !ownerUserId) return NextResponse.json({ error: 'Receivable data is invalid' }, { status: 400 });
    const created = await db.insert(receivables).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create receivable' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'receivables');
    if ('error' in auth) return auth.error;
    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePayload(body);
    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;
    if (!id || !payload || !ownerUserId) return NextResponse.json({ error: 'Receivable data is invalid' }, { status: 400 });
    const updated = await db.update(receivables).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, receivables.id, id, receivables.ownerUserId)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Receivable not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update receivable' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'receivables');
    if ('error' in auth) return auth.error;
    const id = toId(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const deleted = await db.delete(receivables).where(ownedIdWhere(auth.user, receivables.id, id, receivables.ownerUserId)).returning();
    if (!deleted[0]) return NextResponse.json({ error: 'Receivable not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete receivable' }, { status: 500 });
  }
}
