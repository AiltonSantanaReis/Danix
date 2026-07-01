import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '../../auth-utils';

export const dynamic = 'force-dynamic';

const MAX_LOGO_DATA_URL_LENGTH = 1_500_000;
const ALLOWED_LOGO_DATA_URL = /^data:image\/(?:png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[a-zA-Z0-9+/=]+$/;

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawLogo = typeof body.exportLogoData === 'string' ? body.exportLogoData.trim() : '';
    let exportLogoData: string | null = null;

    if (rawLogo) {
      if (rawLogo.length > MAX_LOGO_DATA_URL_LENGTH || !ALLOWED_LOGO_DATA_URL.test(rawLogo)) {
        return NextResponse.json({ error: 'Export logo must be a PNG, JPG, WebP, SVG or ICO image up to 1.5 MB as a data URL' }, { status: 400 });
      }

      exportLogoData = rawLogo;
    }

    const updated = await db.update(users).set({ exportLogoData }).where(eq(users.id, user.id)).returning();
    await syncDatabaseBackup();

    return NextResponse.json({ user: updated[0] ? { ...user, exportLogoData: updated[0].exportLogoData } : user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update export logo' }, { status: 500 });
  }
}
