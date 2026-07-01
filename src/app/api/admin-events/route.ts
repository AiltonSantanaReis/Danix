import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { adminEvents } from '@/db/schema';
import { requireAuth } from '../auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'users');
    if ('error' in auth) return auth.error;
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const events = await db.select().from(adminEvents).orderBy(desc(adminEvents.createdAt)).limit(200);
    return NextResponse.json(events);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch admin events' }, { status: 500 });
  }
}
