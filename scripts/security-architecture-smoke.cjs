const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, 'tmp-security-smoke');
const dataDir = path.join(tmpRoot, 'data');
const backupDir = path.join(tmpRoot, 'database');
const standaloneDir = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'standalone');
const nodeExe = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'node', 'node.exe');
const serverJs = path.join(standaloneDir, 'server.js');
const port = Number(process.env.SECURITY_SMOKE_PORT || 4713);
const baseUrl = `http://127.0.0.1:${port}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function createClient() {
  const client = { cookie: '' };

  client.request = async (route, options = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      redirect: 'manual',
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(client.cookie ? { cookie: client.cookie } : {}),
        ...(options.headers || {}),
      },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      client.cookie = setCookie.split(';')[0];
    }
    return response;
  };

  client.json = async (route, options = {}) => {
    const response = await client.request(route, options);
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
  };

  return client;
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

    const admin = createClient();
    await admin.json('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', displayName: 'Admin Security Smoke', password: 'Admin123!' }),
    });

    const basePermissions = {
      dashboard: true,
      properties: true,
      expenses: true,
      sales: true,
      suppliers: true,
      payables: true,
      invoices: true,
      employees: true,
      receivables: true,
      budgets: true,
      analysis: true,
      export: true,
      recoverUsers: false,
      users: false,
      viewAllData: false,
    };

    await admin.json('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_a', displayName: 'Usuario A', password: 'SenhaA123', role: 'user', permissions: basePermissions, isActive: true }),
    });
    await admin.json('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_b', displayName: 'Usuario B', password: 'SenhaB123', role: 'user', permissions: basePermissions, isActive: true }),
    });
    await admin.json('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'visor',
        displayName: 'Visor Geral',
        password: 'SenhaV123',
        role: 'user',
        permissions: { ...basePermissions, viewAllData: true },
        isActive: true,
      }),
    });

    const userA = createClient();
    await userA.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_a', password: 'SenhaA123' }),
    });
    const property = await userA.json('/api/properties', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Imovel privado usuario A',
        address: 'Rua Isolada, 10',
        purchaseDate: '2026-06-21',
        purchasePrice: 0,
        currentValue: 0,
        status: 'owned',
      }),
    });

    const userB = createClient();
    await userB.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_b', password: 'SenhaB123' }),
    });
    const userBProperties = await userB.json('/api/properties');
    if (userBProperties.some(item => item.name === property.name)) {
      throw new Error('User without viewAllData can see another user property.');
    }

    const forbiddenUpdate = await userB.request('/api/properties', {
      method: 'PUT',
      body: JSON.stringify({ ...property, name: 'Tentativa indevida' }),
    });
    if (forbiddenUpdate.status !== 404) {
      throw new Error(`Cross-user update should be hidden as 404, received ${forbiddenUpdate.status}.`);
    }

    const viewer = createClient();
    await viewer.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'visor', password: 'SenhaV123' }),
    });
    const viewerProperties = await viewer.json('/api/properties');
    if (!viewerProperties.some(item => item.name === property.name)) {
      throw new Error('User with viewAllData cannot see shared local data.');
    }

    const bruteForce = createClient();
    for (let index = 0; index < 5; index += 1) {
      const response = await bruteForce.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'usuario_b', password: `errada-${index}` }),
      });
      if (response.status !== 401 && response.status !== 429) {
        throw new Error(`Unexpected failed-login status: ${response.status}.`);
      }
    }
    const lockedResponse = await bruteForce.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_b', password: 'SenhaB123' }),
    });
    if (lockedResponse.status !== 429) {
      throw new Error(`Login lockout should return 429, received ${lockedResponse.status}.`);
    }

    const passwordClient = createClient();
    await passwordClient.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_a', password: 'SenhaA123' }),
    });
    await passwordClient.json('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'SenhaA123', newPassword: 'NovaSenha123' }),
    });
    const staleSessionResponse = await passwordClient.request('/api/properties');
    if (staleSessionResponse.status !== 401) {
      throw new Error(`Password change should invalidate old sessions, received ${staleSessionResponse.status}.`);
    }
    const reloginClient = createClient();
    await reloginClient.json('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'usuario_a', password: 'NovaSenha123' }),
    });

    console.log(JSON.stringify({
      ok: true,
      isolatedUserProperties: userBProperties.length,
      viewAllDataProperties: viewerProperties.length,
      loginLockoutStatus: lockedResponse.status,
      passwordChanged: true,
    }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(tmpRoot, 'server-output.log'), serverOutput);
    throw error;
  } finally {
    child.kill();
    await sleep(1000);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
