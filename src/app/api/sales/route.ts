import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { properties, sales } from '@/db/schema';
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

const toRequiredNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 0;
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

const parseSalePayload = (body: Record<string, unknown>) => {
  const saleDate = toRequiredString(body.saleDate);
  const salePrice = toRequiredNumber(body.salePrice);
  const commission = toOptionalNumber(body.commission);

  if (!isValidDateString(saleDate) || salePrice === null || commission === null) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    saleDate,
    salePrice,
    buyerName: toOptionalString(body.buyerName),
    commission,
    notes: toOptionalString(body.notes),
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

const syncPropertySaleStatus = async (propertyId: number | null | undefined) => {
  if (!propertyId) return;

  const linkedSale = await db.select({ id: sales.id }).from(sales).where(eq(sales.propertyId, propertyId)).limit(1);

  if (linkedSale.length > 0) {
    await db.update(properties).set({ status: 'sold' }).where(eq(properties.id, propertyId));
    return;
  }

  const currentProperty = await db
    .select({ status: properties.status })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (currentProperty[0]?.status === 'sold') {
    await db.update(properties).set({ status: 'owned' }).where(eq(properties.id, propertyId));
  }
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'sales');
    if ('error' in auth) return auth.error;

    const allSales = canViewAllData(auth.user)
      ? await db.select().from(sales).orderBy(sales.saleDate)
      : await db.select().from(sales).where(eq(sales.ownerUserId, auth.user.id)).orderBy(sales.saleDate);
    return NextResponse.json(allSales);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'sales');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parseSalePayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!payload || !ownerUserId) {
      return NextResponse.json({ error: 'Sale data is invalid' }, { status: 400 });
    }

    const newSale = await db.insert(sales).values({ ...payload, ownerUserId }).returning();
    await syncPropertySaleStatus(payload.propertyId);
    await syncDatabaseBackup();

    return NextResponse.json(newSale[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'sales');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parseSalePayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!id || !payload || !ownerUserId) {
      return NextResponse.json({ error: 'Sale data is invalid' }, { status: 400 });
    }

    const currentSale = await db.select().from(sales).where(ownedIdWhere(auth.user, sales.id, id, sales.ownerUserId)).limit(1);

    if (!currentSale[0]) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const updated = await db.update(sales).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, sales.id, id, sales.ownerUserId)).returning();

    await syncPropertySaleStatus(currentSale[0].propertyId);
    await syncPropertySaleStatus(payload.propertyId);
    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update sale' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'sales');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const deleted = await db.delete(sales).where(ownedIdWhere(auth.user, sales.id, id, sales.ownerUserId)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    await syncPropertySaleStatus(deleted[0].propertyId);
    await syncDatabaseBackup();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
}
