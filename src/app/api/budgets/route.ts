import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { budgets, properties } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth, type AuthUser } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['draft', 'sent', 'approved', 'rejected', 'canceled']);
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
  const title = toRequiredString(body.title);
  const amount = toRequiredNumber(body.amount);
  const validUntil = toOptionalString(body.validUntil);
  const status = toRequiredString(body.status) || 'draft';

  if (!title || amount === null || !isValidDateString(validUntil) || !VALID_STATUSES.has(status)) return null;

  return {
    propertyId: toOptionalId(body.propertyId),
    clientName: toOptionalString(body.clientName),
    title,
    description: toOptionalString(body.description),
    amount,
    validUntil,
    status,
    observation: toOptionalString(body.observation),
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'budgets');
    if ('error' in auth) return auth.error;
    const data = canViewAllData(auth.user)
      ? await db.select().from(budgets).orderBy(budgets.createdAt)
      : await db.select().from(budgets).where(eq(budgets.ownerUserId, auth.user.id)).orderBy(budgets.createdAt);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'budgets');
    if ('error' in auth) return auth.error;
    const payload = parsePayload(await request.json());
    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;
    if (!payload || !ownerUserId) return NextResponse.json({ error: 'Budget data is invalid' }, { status: 400 });
    const created = await db.insert(budgets).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'budgets');
    if ('error' in auth) return auth.error;
    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePayload(body);
    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;
    if (!id || !payload || !ownerUserId) return NextResponse.json({ error: 'Budget data is invalid' }, { status: 400 });
    const updated = await db.update(budgets).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, budgets.id, id, budgets.ownerUserId)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'budgets');
    if ('error' in auth) return auth.error;
    const id = toId(new URL(request.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    const deleted = await db.delete(budgets).where(ownedIdWhere(auth.user, budgets.id, id, budgets.ownerUserId)).returning();
    if (!deleted[0]) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
