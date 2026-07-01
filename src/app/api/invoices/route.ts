import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { invoices, properties, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidDateString } from '../_shared';
import { canViewAllData, ownedIdWhere, requireAuth, type AuthUser } from '../auth-utils';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['open', 'paid', 'overdue', 'canceled']);
const VALID_TYPES = new Set(['payable', 'receivable']);

const toRequiredString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const toOptionalString = (value: unknown) => {
  const stringValue = typeof value === 'string' ? value.trim() : '';
  return stringValue || null;
};
const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
};
const allowedAttachmentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const parseAttachmentFields = (body: Record<string, unknown>) => {
  const name = toOptionalString(body.attachmentName);
  const type = toOptionalString(body.attachmentType);
  const data = toOptionalString(body.attachmentData);

  if (!name && !type && !data) {
    return {};
  }

  if (!name || !type || !data || !allowedAttachmentTypes.has(type) || !data.startsWith(`data:${type};base64,`) || data.length > 8_500_000) {
    return null;
  }

  return {
    attachmentName: name.slice(0, 180),
    attachmentType: type,
    attachmentData: data,
  };
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

const resolveOwner = async (user: AuthUser, propertyId: number | null, supplierId: number | null) => {
  let ownerUserId: number | null = null;

  if (propertyId) {
    const found = await db
      .select({ ownerUserId: properties.ownerUserId })
      .from(properties)
      .where(ownedIdWhere(user, properties.id, propertyId, properties.ownerUserId))
      .limit(1);
    if (!found[0]) return null;
    ownerUserId = found[0].ownerUserId ?? user.id;
  }

  if (supplierId) {
    const found = await db
      .select({ ownerUserId: suppliers.ownerUserId })
      .from(suppliers)
      .where(ownedIdWhere(user, suppliers.id, supplierId, suppliers.ownerUserId))
      .limit(1);
    if (!found[0]) return null;
    const supplierOwner = found[0].ownerUserId ?? user.id;
    if (ownerUserId && supplierOwner !== ownerUserId) return null;
    ownerUserId = supplierOwner;
  }

  return ownerUserId ?? user.id;
};

const parsePayload = (body: Record<string, unknown>) => {
  const issueDate = toOptionalString(body.issueDate);
  const dueDate = toOptionalString(body.dueDate);
  const status = toRequiredString(body.status) || 'open';
  const type = toRequiredString(body.type) || 'payable';
  const attachment = parseAttachmentFields(body);

  if (!isValidDateString(issueDate) || !isValidDateString(dueDate) || !attachment || !VALID_STATUSES.has(status) || !VALID_TYPES.has(type)) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    supplierId: toOptionalId(body.supplierId),
    clientName: toOptionalString(body.clientName),
    number: toOptionalString(body.number),
    issueDate,
    dueDate,
    ...attachment,
    amount: toOptionalNumber(body.amount),
    status,
    type,
    description: toOptionalString(body.description),
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'invoices');
    if ('error' in auth) return auth.error;

    const allInvoices = canViewAllData(auth.user)
      ? await db.select().from(invoices).orderBy(invoices.issueDate)
      : await db.select().from(invoices).where(eq(invoices.ownerUserId, auth.user.id)).orderBy(invoices.issueDate);
    return NextResponse.json(allInvoices);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'invoices');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parsePayload(body);
    const ownerUserId = payload ? await resolveOwner(auth.user, payload.propertyId, payload.supplierId) : null;
    if (!payload || !ownerUserId) return NextResponse.json({ error: 'Invoice data is invalid' }, { status: 400 });

    const created = await db.insert(invoices).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(created[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'invoices');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parsePayload(body);
    const ownerUserId = payload ? await resolveOwner(auth.user, payload.propertyId, payload.supplierId) : null;
    if (!id || !payload || !ownerUserId) return NextResponse.json({ error: 'Invoice data is invalid' }, { status: 400 });

    const updated = await db.update(invoices).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, invoices.id, id, invoices.ownerUserId)).returning();
    if (!updated[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'invoices');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const deleted = await db.delete(invoices).where(ownedIdWhere(auth.user, invoices.id, id, invoices.ownerUserId)).returning();
    if (!deleted[0]) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
