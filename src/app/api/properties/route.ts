import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { budgets, expenses, invoices, payables, properties, receivables, sales, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['owned', 'sold', 'under_reform']);

const toRequiredString = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toRequiredNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const parsePropertyPayload = (body: Record<string, unknown>) => {
  const name = toRequiredString(body.name);
  const address = toRequiredString(body.address);
  const purchaseDate = toRequiredString(body.purchaseDate);
  const purchasePrice = toOptionalNumber(body.purchasePrice) ?? 0;
  const currentValue = toOptionalNumber(body.currentValue);
  const status = toRequiredString(body.status) || 'owned';

  if (!name || !address || !isValidDateString(purchaseDate) || purchasePrice < 0 || !VALID_STATUSES.has(status)) {
    return null;
  }

  return {
    name,
    address,
    purchaseDate,
    purchasePrice,
    currentValue,
    status,
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'properties');
    if ('error' in auth) return auth.error;

    const allProperties = canViewAllData(auth.user)
      ? await db.select().from(properties).orderBy(properties.purchaseDate)
      : await db.select().from(properties).where(eq(properties.ownerUserId, auth.user.id)).orderBy(properties.purchaseDate);
    return NextResponse.json(allProperties);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'properties');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parsePropertyPayload(body);

    if (!payload) {
      return NextResponse.json({ error: 'Property data is invalid' }, { status: 400 });
    }

    const newProperty = await db.insert(properties).values({ ...payload, ownerUserId: auth.user.id }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(newProperty[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'properties');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePropertyPayload(body);

    if (!id || !payload) {
      return NextResponse.json({ error: 'Property data is invalid' }, { status: 400 });
    }

    const updated = await db.update(properties).set(payload).where(ownedIdWhere(auth.user, properties.id, id, properties.ownerUserId)).returning();

    if (!updated[0]) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'properties');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const property = await db.select({ id: properties.id }).from(properties).where(ownedIdWhere(auth.user, properties.id, id, properties.ownerUserId)).limit(1);

    if (!property[0]) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const linkedExpense = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.propertyId, id)).limit(1);
    const linkedSale = await db.select({ id: sales.id }).from(sales).where(eq(sales.propertyId, id)).limit(1);
    const linkedSupplier = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.propertyId, id)).limit(1);
    const linkedPayable = await db.select({ id: payables.id }).from(payables).where(eq(payables.propertyId, id)).limit(1);
    const linkedInvoice = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.propertyId, id)).limit(1);
    const linkedReceivable = await db.select({ id: receivables.id }).from(receivables).where(eq(receivables.propertyId, id)).limit(1);
    const linkedBudget = await db.select({ id: budgets.id }).from(budgets).where(eq(budgets.propertyId, id)).limit(1);

    if (
      linkedExpense.length > 0 ||
      linkedSale.length > 0 ||
      linkedSupplier.length > 0 ||
      linkedPayable.length > 0 ||
      linkedInvoice.length > 0 ||
      linkedReceivable.length > 0 ||
      linkedBudget.length > 0
    ) {
      return NextResponse.json(
        { error: 'Cannot delete a property with linked records' },
        { status: 409 }
      );
    }

    const deleted = await db.delete(properties).where(eq(properties.id, id)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
