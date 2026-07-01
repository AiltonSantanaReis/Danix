const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, 'tmp-backup-smoke');
const dataDir = path.join(tmpRoot, 'data');
const backupDir = path.join(tmpRoot, 'database');
const standaloneDir = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'standalone');
const nodeExe = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'node', 'node.exe');
const serverJs = path.join(standaloneDir, 'server.js');
const port = Number(process.env.BACKUP_SMOKE_PORT || 4712);
const baseUrl = `http://127.0.0.1:${port}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    redirect: 'manual',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const session = setCookie.split(';')[0];
    request.cookie = session;
  }
  return response;
}

async function json(route, options = {}) {
  const response = await request(route, {
    ...options,
    headers: {
      ...(request.cookie ? { cookie: request.cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`${route} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function waitForServer() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  throw new Error('Server did not start.');
}

async function main() {
  if (!fs.existsSync(nodeExe) || !fs.existsSync(serverJs)) {
    throw new Error('Portable standalone not found. Run build-portable.cmd first.');
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  const child = spawn(nodeExe, [serverJs], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      APP_DATA_DIR: dataDir,
      BACKUP_DATABASE_DIR: backupDir,
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  child.stdout.on('data', chunk => {
    serverOutput += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer();

    await json('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', displayName: 'Admin Backup Smoke', password: 'Admin123!' }),
    });

    await json('/api/properties', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Imovel antes do backup',
        address: 'Rua Backup, 100',
        purchaseDate: '2026-06-19',
        purchasePrice: 0,
        currentValue: 0,
        status: 'owned',
      }),
    });

    await json('/api/payables', {
      method: 'POST',
      body: JSON.stringify({
        product: 'Conta proxima do vencimento',
        services: '',
        purchaseDate: '2026-06-19',
        amount: 123.45,
        dueDate: '2026-06-22',
        status: 'open',
        paymentMethod: 'Pix',
      }),
    });

    const exportResponse = await request('/api/backup', {
      headers: { cookie: request.cookie },
    });
    if (!exportResponse.ok) {
      throw new Error(`Backup export failed with ${exportResponse.status}`);
    }
    const backupBuffer = Buffer.from(await exportResponse.arrayBuffer());
    if (backupBuffer.length < 1024) {
      throw new Error('Backup file is unexpectedly small.');
    }

    await json('/api/properties', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Imovel depois do backup',
        address: 'Rua Temporaria, 200',
        purchaseDate: '2026-06-19',
        purchasePrice: 0,
        currentValue: 0,
        status: 'owned',
      }),
    });

    const formData = new FormData();
    formData.append('file', new Blob([backupBuffer], { type: 'application/vnd.sqlite3' }), 'danix-backup-smoke.db');

    const importResponse = await request('/api/backup', {
      method: 'POST',
      headers: { cookie: request.cookie },
      body: formData,
    });
    if (!importResponse.ok) {
      const text = await importResponse.text();
      fs.writeFileSync(path.join(tmpRoot, 'server-output.log'), serverOutput);
      throw new Error(`Backup import failed with ${importResponse.status}: ${text}`);
    }

    request.cookie = '';
    await json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'Admin123!' }),
    });

    const properties = await json('/api/properties', { headers: { cookie: request.cookie } });
    const names = properties.map(property => property.name);
    if (!names.includes('Imovel antes do backup')) {
      throw new Error('Restored backup did not include original property.');
    }
    if (names.includes('Imovel depois do backup')) {
      throw new Error('Restore did not remove data created after backup export.');
    }

    const payables = await json('/api/payables', { headers: { cookie: request.cookie } });
    if (!payables.some(payable => payable.product === 'Conta proxima do vencimento')) {
      throw new Error('Restored backup did not include payable used by dashboard alert.');
    }

    console.log(JSON.stringify({ ok: true, backupBytes: backupBuffer.length, restoredProperties: names.length, payables: payables.length }, null, 2));
  } finally {
    child.kill();
    await sleep(1000);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
