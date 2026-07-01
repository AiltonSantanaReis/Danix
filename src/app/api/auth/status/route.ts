import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserCount, PERMISSION_LABELS } from '../../auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const hasUsers = Boolean(await getUserCount());
  const user = hasUsers ? await getCurrentUser(request) : null;

  return NextResponse.json({
    hasUsers,
    authenticated: Boolean(user),
    user,
    permissionLabels: PERMISSION_LABELS,
  });
}
