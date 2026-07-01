import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { createManualBackup, restoreManualBackup } from '@/db';
import { clearSessionCookie, recordAdminEvent, requireAuth } from '../auth-utils';

export const dynamic = 'force-dynamic';

const isAdmin = (role: string) => role === 'admin';

const backupFileName = () => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `danix-backup-${timestamp}.db`;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, 'users');
    if ('error' in auth) return auth.error;
    if (!isAdmin(auth.user.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem exportar backup completo.' }, { status: 403 });
    }

    const backupPath = await createManualBackup();
    const file = fs.readFileSync(backupPath);
    await recordAdminEvent(auth.user, 'backup_exported', 'backup', null, 'Backup manual exportado');

    return new NextResponse(file, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.sqlite3',
        'content-disposition': `attachment; filename="${backupFileName()}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erro tecnico ao exportar backup manual', error);
    return NextResponse.json({ error: 'Nao foi possivel exportar o backup.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let temporaryPath = '';

  try {
    const auth = await requireAuth(request, 'users');
    if ('error' in auth) return auth.error;
    if (!isAdmin(auth.user.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem importar backup completo.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Selecione um arquivo de backup valido.' }, { status: 400 });
    }

    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo de backup e muito grande.' }, { status: 400 });
    }

    temporaryPath = path.join(os.tmpdir(), `danix-restore-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    fs.writeFileSync(temporaryPath, Buffer.from(await file.arrayBuffer()));

    await restoreManualBackup(temporaryPath);
    await recordAdminEvent(auth.user, 'backup_imported', 'backup', null, `Backup manual importado: ${file.name}`);

    const response = NextResponse.json({
      ok: true,
      message: 'Backup importado com sucesso. Entre novamente para carregar os dados restaurados.',
    });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Erro tecnico ao importar backup manual', error);
    return NextResponse.json({ error: 'Nao foi possivel importar o backup. Verifique se o arquivo e um backup valido do Danix.' }, { status: 500 });
  } finally {
    if (temporaryPath) {
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch (error) {
        console.error('Erro tecnico ao remover backup temporario', error);
      }
    }
  }
}
