import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { expenses, properties } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth, type AuthUser } from '../auth-utils';

export const dynamic = 'force-dynamic';

const toRequiredString = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const toOptionalString = (value: unknown) => {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  return stringValue || null;
};

const allowedAttachmentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const parseAttachmentFields = (body: Record<string, unknown>) => {
  const name = toOptionalString(body.invoiceAttachmentName);
  const type = toOptionalString(body.invoiceAttachmentType);
  const data = toOptionalString(body.invoiceAttachmentData);

  if (!name && !type && !data) {
    return {};
  }

  if (!name || !type || !data || !allowedAttachmentTypes.has(type) || !data.startsWith(`data:${type};base64,`) || data.length > 8_500_000) {
    return null;
  }

  return {
    invoiceAttachmentName: name.slice(0, 180),
    invoiceAttachmentType: type,
    invoiceAttachmentData: data,
  };
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

const parseExpensePayload = (body: Record<string, unknown>) => {
  const category = toRequiredString(body.category);
  const item = toRequiredString(body.item);
  const amount = toRequiredNumber(body.amount);
  const purchaseDate = toRequiredString(body.purchaseDate);
  const invoiceDate = toOptionalString(body.invoiceDate);
  const attachment = parseAttachmentFields(body);

  if (!item || amount === null || !isValidDateString(purchaseDate) || !isValidDateString(invoiceDate) || !attachment) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    category,
    item,
    amount,
    purchaseDate,
    invoiceNumber: toOptionalString(body.invoiceNumber),
    invoiceDate,
    ...attachment,
    description: toOptionalString(body.description),
  };
};

const resolveOwnerForProperty = async (user: AuthUser, propertyId: number | null) => {
  if (!propertyId) return user.id;

  const found = await db
    .select({ id: properties.id, ownerUserId: properties.ownerUserId })
    .from(properties)
    .where(ownedIdWhere(user, properties.id, propertyId, properties.ownerUserId))
    .limit(1);

  if (!found[0]) return null;
  return found[0].ownerUserId ?? user.id;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'expenses');
    if ('error' in auth) return auth.error;

    const allExpenses = canViewAllData(auth.user)
      ? await db.select().from(expenses).orderBy(expenses.purchaseDate)
      : await db.select().from(expenses).where(eq(expenses.ownerUserId, auth.user.id)).orderBy(expenses.purchaseDate);
    return NextResponse.json(allExpenses);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'expenses');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parseExpensePayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!payload || !ownerUserId) {
      return NextResponse.json({ error: 'Expense data is invalid' }, { status: 400 });
    }

    const newExpense = await db.insert(expenses).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(newExpense[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'expenses');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parseExpensePayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!id || !payload || !ownerUserId) {
      return NextResponse.json({ error: 'Expense data is invalid' }, { status: 400 });
    }

    const updated = await db.update(expenses).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, expenses.id, id, expenses.ownerUserId)).returning();

    if (!updated[0]) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'expenses');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const deleted = await db.delete(expenses).where(ownedIdWhere(auth.user, expenses.id, id, expenses.ownerUserId)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
