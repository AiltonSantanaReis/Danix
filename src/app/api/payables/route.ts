import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { payables, properties, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth, type AuthUser } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['open', 'paid', 'overdue']);

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

const toOptionalPositiveInteger = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const parsePayablePayload = (body: Record<string, unknown>) => {
  const product = toOptionalString(body.product);
  const services = toOptionalString(body.services);
  const purchaseDate = toRequiredString(body.purchaseDate);
  const amount = toRequiredNumber(body.amount);
  const dueDate = toRequiredString(body.dueDate);
  const status = toRequiredString(body.status) || 'open';
  const invoiceDate = toOptionalString(body.invoiceDate);
  const attachment = parseAttachmentFields(body);

  if (
    (!product && !services) ||
    !isValidDateString(purchaseDate) ||
    amount === null ||
    !isValidDateString(dueDate) ||
    !isValidDateString(invoiceDate) ||
    !attachment ||
    !VALID_STATUSES.has(status)
  ) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    supplierId: toOptionalId(body.supplierId),
    supplierName: toOptionalString(body.supplierName),
    product,
    services,
    purchaseDate,
    amount,
    invoiceDate,
    invoiceNumber: toOptionalString(body.invoiceNumber),
    ...attachment,
    term: toOptionalString(body.term),
    paymentMethod: toOptionalString(body.paymentMethod),
    dueDate,
    status,
    observation: toOptionalString(body.observation),
    installmentNumber: toOptionalPositiveInteger(body.installmentNumber),
    installmentTotal: toOptionalPositiveInteger(body.installmentTotal),
  };
};

const resolvePropertyOwner = async (user: AuthUser, propertyId: number | null) => {
  if (!propertyId) return null;

  const found = await db
    .select({ id: properties.id, ownerUserId: properties.ownerUserId })
    .from(properties)
    .where(ownedIdWhere(user, properties.id, propertyId, properties.ownerUserId))
    .limit(1);

  if (!found[0]) return undefined;
  return found[0].ownerUserId ?? user.id;
};

const resolveSupplierOwner = async (user: AuthUser, supplierId: number | null) => {
  if (!supplierId) return null;

  const found = await db
    .select({ id: suppliers.id, ownerUserId: suppliers.ownerUserId })
    .from(suppliers)
    .where(ownedIdWhere(user, suppliers.id, supplierId, suppliers.ownerUserId))
    .limit(1);

  if (!found[0]) return undefined;
  return found[0].ownerUserId ?? user.id;
};

const resolveOwnerForPayable = async (user: AuthUser, propertyId: number | null, supplierId: number | null) => {
  const propertyOwner = await resolvePropertyOwner(user, propertyId);
  const supplierOwner = await resolveSupplierOwner(user, supplierId);

  if (propertyOwner === undefined || supplierOwner === undefined) return null;
  if (propertyOwner && supplierOwner && propertyOwner !== supplierOwner) return null;

  return propertyOwner ?? supplierOwner ?? user.id;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'payables');
    if ('error' in auth) return auth.error;

    const allPayables = canViewAllData(auth.user)
      ? await db.select().from(payables).orderBy(payables.dueDate)
      : await db.select().from(payables).where(eq(payables.ownerUserId, auth.user.id)).orderBy(payables.dueDate);
    return NextResponse.json(allPayables);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch payables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'payables');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parsePayablePayload(body);

    const ownerUserId = payload ? await resolveOwnerForPayable(auth.user, payload.propertyId, payload.supplierId) : null;

    if (!payload || !ownerUserId) {
      return NextResponse.json({ error: 'Payable data is invalid' }, { status: 400 });
    }

    const newPayable = await db.insert(payables).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(newPayable[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create payable' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'payables');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePayablePayload(body);

    const ownerUserId = payload ? await resolveOwnerForPayable(auth.user, payload.propertyId, payload.supplierId) : null;

    if (!id || !payload || !ownerUserId) {
      return NextResponse.json({ error: 'Payable data is invalid' }, { status: 400 });
    }

    const updated = await db.update(payables).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, payables.id, id, payables.ownerUserId)).returning();

    if (!updated[0]) {
      return NextResponse.json({ error: 'Payable not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update payable' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'payables');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const deleted = await db.delete(payables).where(ownedIdWhere(auth.user, payables.id, id, payables.ownerUserId)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Payable not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete payable' }, { status: 500 });
  }
}
