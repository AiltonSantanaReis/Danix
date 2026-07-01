import { NextRequest, NextResponse } from 'next/server';
import { db, syncDatabaseBackup } from '@/db';
import { invoices, payables, properties, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

const toId = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const toOptionalId = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
};

const parseSupplierPayload = (body: Record<string, unknown>) => {
  const legalName = toRequiredString(body.legalName);
  const category = toRequiredString(body.category);
  const status = toRequiredString(body.status) || 'open';

  if (!legalName || !VALID_STATUSES.has(status)) {
    return null;
  }

  return {
    propertyId: toOptionalId(body.propertyId),
    legalName,
    tradeName: toOptionalString(body.tradeName),
    cnpj: toOptionalString(body.cnpj),
    phone: toOptionalString(body.phone),
    email: toOptionalString(body.email),
    category,
    status,
    observation: toOptionalString(body.observation),
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
    const auth = await requireAuth(request, 'suppliers');
    if ('error' in auth) return auth.error;

    const allSuppliers = canViewAllData(auth.user)
      ? await db.select().from(suppliers).orderBy(suppliers.legalName)
      : await db.select().from(suppliers).where(eq(suppliers.ownerUserId, auth.user.id)).orderBy(suppliers.legalName);
    return NextResponse.json(allSuppliers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'suppliers');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const payload = parseSupplierPayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!payload || !ownerUserId) {
      return NextResponse.json({ error: 'Supplier data is invalid' }, { status: 400 });
    }

    const newSupplier = await db.insert(suppliers).values({ ...payload, ownerUserId }).returning();
    await syncDatabaseBackup();
    return NextResponse.json(newSupplier[0], { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'suppliers');
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const id = toId(body.id);
    const payload = parseSupplierPayload(body);

    const ownerUserId = payload ? await resolveOwnerForProperty(auth.user, payload.propertyId) : null;

    if (!id || !payload || !ownerUserId) {
      return NextResponse.json({ error: 'Supplier data is invalid' }, { status: 400 });
    }

    const updated = await db.update(suppliers).set({ ...payload, ownerUserId }).where(ownedIdWhere(auth.user, suppliers.id, id, suppliers.ownerUserId)).returning();

    if (!updated[0]) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'suppliers');
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = toId(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supplier = await db.select({ id: suppliers.id }).from(suppliers).where(ownedIdWhere(auth.user, suppliers.id, id, suppliers.ownerUserId)).limit(1);
    if (!supplier[0]) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const linkedPayable = await db.select({ id: payables.id }).from(payables).where(eq(payables.supplierId, id)).limit(1);
    const linkedInvoice = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.supplierId, id)).limit(1);

    if (linkedPayable.length > 0 || linkedInvoice.length > 0) {
      return NextResponse.json({ error: 'Cannot delete a supplier with linked records' }, { status: 409 });
    }

    const deleted = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await syncDatabaseBackup();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
