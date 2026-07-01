import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, syncDatabaseBackup } from '@/db';
import { adminEvents, sessions, users, type User } from '@/db/schema';

export const SESSION_COOKIE = 'danix_session';

export const PERMISSION_KEYS = [
  'dashboard',
  'properties',
  'expenses',
  'sales',
  'suppliers',
  'payables',
  'invoices',
  'employees',
  'receivables',
  'budgets',
  'analysis',
  'export',
  'recoverUsers',
  'users',
  'viewAllData',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];
export type PermissionMap = Record<PermissionKey, boolean>;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Dashboard',
  properties: 'Imoveis',
  expenses: 'Despesas',
  sales: 'Vendas',
  suppliers: 'Fornecedores',
  payables: 'Contas a pagar',
  invoices: 'Notas fiscais',
  employees: 'Funcionarios',
  receivables: 'Contas a receber',
  budgets: 'Orcamentos',
  analysis: 'Analise de custo',
  export: 'Exportar relatorios',
  recoverUsers: 'Gerar codigos de recuperacao',
  users: 'Usuarios e permissoes',
  viewAllData: 'Ver dados de todos',
};

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: PermissionMap;
  isActive: boolean;
  exportLogoData?: string | null;
}

export const normalizePermissions = (value: unknown, role = 'user'): PermissionMap => {
  const defaults = Object.fromEntries(PERMISSION_KEYS.map(key => [key, role === 'admin'])) as PermissionMap;
  if (!value) return defaults;

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return defaults;
    return Object.fromEntries(
      PERMISSION_KEYS.map(key => [key, Boolean((parsed as Partial<PermissionMap>)[key]) || role === 'admin'])
    ) as PermissionMap;
  } catch {
    return defaults;
  }
};

export const serializePermissions = (permissions: Partial<PermissionMap>, role = 'user') => {
  return JSON.stringify(normalizePermissions(permissions, role));
};

export const publicUser = (user: User): AuthUser => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  permissions: normalizePermissions(user.permissions, user.role),
  isActive: user.isActive === 1,
  exportLogoData: user.exportLogoData,
});

export const hashSecret = (secret: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifySecret = (secret: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(secret, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
};

export const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const getUserCount = async () => {
  const allUsers = await db.select({ id: users.id }).from(users).limit(1);
  return allUsers.length;
};

export const createSession = async (userId: number) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  await db.insert(sessions).values({
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
  });
  await syncDatabaseBackup();
  return { token, expiresAt };
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // O desktop portatil usa HTTP local em 127.0.0.1; secure:true exigiria HTTPS e quebraria a sessao.
  secure: false,
  path: '/',
};

export const setSessionCookie = (response: NextResponse, token: string, expiresAt: string) => {
  response.cookies.set(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    expires: new Date(expiresAt),
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions,
    expires: new Date(0),
  });
};

export const recordAdminEvent = async (
  actor: Pick<AuthUser, 'id' | 'username'> | null,
  action: string,
  targetType?: string,
  targetId?: number | null,
  details?: string,
) => {
  await db.insert(adminEvents).values({
    actorUserId: actor?.id ?? null,
    actorUsername: actor?.username ?? null,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    details: details ? details.slice(0, 500) : null,
  });
  await syncDatabaseBackup();
};

export const getCurrentUser = async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash(token)))
    .limit(1);
  const session = sessionRows[0];

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    if (session) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      await syncDatabaseBackup();
    }
    return null;
  }

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = userRows[0];
  if (!user || user.isActive !== 1) return null;
  return publicUser(user);
};

export const requireAuth = async (request: NextRequest, permission?: PermissionKey) => {
  const hasUsers = await getUserCount();
  if (!hasUsers) {
    return { error: NextResponse.json({ error: 'Setup required' }, { status: 428 }) };
  }

  const user = await getCurrentUser(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  if (permission && !user.permissions[permission]) {
    return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) };
  }

  return { user };
};

export const canViewAllData = (user: AuthUser) => user.permissions.viewAllData;

export const ownerWhere = <T>(user: AuthUser, ownerColumn: T) => {
  return canViewAllData(user) ? undefined : eq(ownerColumn as never, user.id);
};

export const ownedIdWhere = <TId, TOwner>(user: AuthUser, idColumn: TId, id: number, ownerColumn: TOwner) => {
  const idWhere = eq(idColumn as never, id);
  return canViewAllData(user) ? idWhere : and(idWhere, eq(ownerColumn as never, user.id));
};

export const generateRecoveryCode = () => {
  return crypto.randomBytes(12).toString('hex').replace(/(.{4})/g, '$1-').replace(/-$/, '').toUpperCase();
};
