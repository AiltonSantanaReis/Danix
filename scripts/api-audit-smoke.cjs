const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, 'tmp-api-audit-smoke');
const appDataDir = path.join(tmpRoot, 'app-data');
const backupDir = path.join(tmpRoot, 'database');
const nodeExe = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'node', 'node.exe');
const serverJs = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'standalone', 'server.js');
const port = 4687;
const baseUrl = `http://127.0.0.1:${port}`;

if (!fs.existsSync(nodeExe) || !fs.existsSync(serverJs)) {
  throw new Error('Portable standalone is missing. Run build-portable.cmd first.');
}

fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(appDataDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

const server = spawn(nodeExe, [serverJs], {
  cwd: path.dirname(serverJs),
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    APP_DATA_DIR: appDataDir,
    BACKUP_DATABASE_DIR: backupDir,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let cookie = '';

const request = async (route, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

const waitForServer = async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  throw new Error('Standalone server did not become ready.');
};

const expectStatus = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}`);
  }
  console.log(`ok - ${label}`);
};

const post = (route, body) => request(route, { method: 'POST', body: JSON.stringify(body) });
const put = (route, body) => request(route, { method: 'PUT', body: JSON.stringify(body) });
const del = route => request(route, { method: 'DELETE' });

(async () => {
  try {
    await waitForServer();

    const setup = await post('/api/auth/setup', {
      username: 'admin',
      displayName: 'Admin',
      password: '123456',
    });
    expectStatus('first user setup', setup.status, 200);

    const propertyWithInvoice = await post('/api/properties', {
      name: 'Imovel Nota',
      address: 'Rua A',
      purchaseDate: '2026-01-10',
      purchasePrice: '',
      currentValue: '',
      status: 'owned',
    });
    expectStatus('create property for invoice', propertyWithInvoice.status, 201);

    const supplierWithInvoice = await post('/api/suppliers', {
      propertyId: propertyWithInvoice.body.id,
      legalName: 'Fornecedor Nota',
      tradeName: '',
      cnpj: '',
      phone: '',
      email: '',
      category: '',
      status: 'open',
      observation: '',
    });
    expectStatus('create supplier for invoice', supplierWithInvoice.status, 201);

    const invoice = await post('/api/invoices', {
      propertyId: propertyWithInvoice.body.id,
      supplierId: supplierWithInvoice.body.id,
      clientName: '',
      number: '',
      issueDate: '',
      dueDate: '',
      amount: '',
      status: 'open',
      type: 'payable',
      description: 'Nota vinculada',
    });
    expectStatus('create linked invoice', invoice.status, 201);

    const deletePropertyWithInvoice = await del(`/api/properties?id=${propertyWithInvoice.body.id}`);
    expectStatus('property with linked invoice is protected', deletePropertyWithInvoice.status, 409);

    const deleteSupplierWithInvoice = await del(`/api/suppliers?id=${supplierWithInvoice.body.id}`);
    expectStatus('supplier with linked invoice is protected', deleteSupplierWithInvoice.status, 409);

    const propertyWithReceivable = await post('/api/properties', {
      name: 'Imovel Receber',
      address: 'Rua B',
      purchaseDate: '2026-01-11',
      purchasePrice: '',
      currentValue: '',
      status: 'owned',
    });
    expectStatus('create property for receivable', propertyWithReceivable.status, 201);

    const receivable = await post('/api/receivables', {
      propertyId: propertyWithReceivable.body.id,
      clientName: 'Cliente',
      description: 'Recebivel vinculado',
      amount: '150',
      issueDate: '',
      dueDate: '2026-02-10',
      receivedDate: '',
      status: 'open',
      paymentMethod: '',
      observation: '',
    });
    expectStatus('create linked receivable', receivable.status, 201);

    const deletePropertyWithReceivable = await del(`/api/properties?id=${propertyWithReceivable.body.id}`);
    expectStatus('property with linked receivable is protected', deletePropertyWithReceivable.status, 409);

    const propertyWithBudget = await post('/api/properties', {
      name: 'Imovel Orcamento',
      address: 'Rua C',
      purchaseDate: '2026-01-12',
      purchasePrice: '',
      currentValue: '',
      status: 'owned',
    });
    expectStatus('create property for budget', propertyWithBudget.status, 201);

    const budget = await post('/api/budgets', {
      propertyId: propertyWithBudget.body.id,
      clientName: '',
      title: 'Orcamento vinculado',
      description: '',
      amount: '300',
      validUntil: '',
      status: 'draft',
      observation: '',
    });
    expectStatus('create linked budget', budget.status, 201);

    const deletePropertyWithBudget = await del(`/api/properties?id=${propertyWithBudget.body.id}`);
    expectStatus('property with linked budget is protected', deletePropertyWithBudget.status, 409);

    const invalidLogo = await put('/api/auth/logo', {
      exportLogoData: 'data:text/plain;base64,SGVsbG8=',
    });
    expectStatus('invalid logo data URL is rejected', invalidLogo.status, 400);

    const oversizeLogo = await put('/api/auth/logo', {
      exportLogoData: `data:image/png;base64,${'A'.repeat(1_500_001)}`,
    });
    expectStatus('oversized logo is rejected', oversizeLogo.status, 400);

    const validLogo = await put('/api/auth/logo', {
      exportLogoData: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expectStatus('valid logo is accepted', validLogo.status, 200);

    if (!fs.existsSync(path.join(backupDir, 'danix.db'))) {
      throw new Error('Backup database was not created.');
    }
    console.log('ok - backup database copy exists');
  } finally {
    server.kill();
  }
})().catch(error => {
  server.kill();
  console.error(error);
  process.exitCode = 1;
});
