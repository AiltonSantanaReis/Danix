const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tmpRoot = path.join(root, 'tmp-crud-regression-smoke');
const appDataDir = path.join(tmpRoot, 'app-data');
const backupDir = path.join(tmpRoot, 'database');
const nodeExe = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'node', 'node.exe');
const serverJs = path.join(root, 'dist-portable-ready', 'win-unpacked', 'resources', 'standalone', 'server.js');
const port = 4723;
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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      await delay(300);
    }
  }
  throw new Error('Standalone server did not become ready.');
};

const expect = (condition, label) => {
  if (!condition) throw new Error(label);
};

const expectStatus = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}`);
  }
};

const logOk = label => console.log(`ok - ${label}`);

const post = (route, body) => request(route, { method: 'POST', body: JSON.stringify(body) });
const put = (route, body) => request(route, { method: 'PUT', body: JSON.stringify(body) });
const del = route => request(route, { method: 'DELETE' });

const list = async route => {
  const response = await request(route);
  expectStatus(`GET ${route}`, response.status, 200);
  expect(Array.isArray(response.body), `${route}: expected an array response`);
  return response.body;
};

const byId = (items, id) => items.find(item => item.id === id);

const expectVisible = async (route, id, label, predicate = () => true) => {
  const items = await list(route);
  const found = byId(items, id);
  expect(found, `${label}: record ${id} should be visible`);
  expect(predicate(found), `${label}: record ${id} did not match expected state`);
  return found;
};

const expectAbsent = async (route, id, label) => {
  const items = await list(route);
  expect(!byId(items, id), `${label}: record ${id} should not be visible after permanent deletion`);
};

const createRecord = async (route, payload, label) => {
  const response = await post(route, payload);
  expectStatus(label, response.status, 201);
  expect(response.body?.id, `${label}: response did not include an id`);
  await expectVisible(route, response.body.id, `${label} visible after creation`);
  return response.body;
};

const updateRecord = async (route, payload, label, predicate) => {
  const response = await put(route, payload);
  expectStatus(label, response.status, 200);
  await expectVisible(route, payload.id, `${label} visible after update`, predicate);
  return response.body;
};

const deleteRecord = async (route, id, label) => {
  const response = await del(`${route}?id=${id}`);
  expectStatus(label, response.status, 200);
  await expectAbsent(route, id, `${label} absent after deletion`);
};

const runCrudCycle = async cycle => {
  const suffix = `CRUD ${cycle}`;

  const property = await createRecord('/api/properties', {
    name: `Imovel ${suffix}`,
    address: `Rua Teste ${cycle}`,
    purchaseDate: '2026-01-10',
    purchasePrice: '',
    currentValue: '',
    status: 'owned',
  }, `${suffix}: create property`);

  const supplier = await createRecord('/api/suppliers', {
    propertyId: property.id,
    legalName: `Fornecedor ${suffix}`,
    tradeName: '',
    cnpj: '',
    phone: '11999990000',
    email: '',
    category: '',
    status: 'open',
    observation: 'Teste automatico',
  }, `${suffix}: create supplier`);

  await updateRecord('/api/suppliers', {
    ...supplier,
    legalName: `Fornecedor ${suffix} Editado`,
    status: 'paid',
  }, `${suffix}: update supplier`, item => item.legalName.endsWith('Editado') && item.status === 'paid');

  const expense = await createRecord('/api/expenses', {
    propertyId: property.id,
    category: '',
    item: `Despesa ${suffix}`,
    amount: '100.50',
    purchaseDate: '2026-01-11',
    invoiceNumber: '',
    invoiceDate: '',
    description: 'Criada no teste',
  }, `${suffix}: create expense`);

  await updateRecord('/api/expenses', {
    ...expense,
    category: 'Manutencao',
    item: `Despesa ${suffix} Editada`,
    amount: '125.75',
    purchaseDate: '2026-01-12',
  }, `${suffix}: update expense`, item => item.item.endsWith('Editada') && Number(item.amount) === 125.75);

  const sale = await createRecord('/api/sales', {
    propertyId: property.id,
    saleDate: '2026-01-13',
    salePrice: '1000',
    buyerName: `Comprador ${suffix}`,
    commission: '10',
    notes: '',
  }, `${suffix}: create sale`);

  await updateRecord('/api/sales', {
    ...sale,
    saleDate: '2026-01-14',
    salePrice: '1100',
    buyerName: `Comprador ${suffix} Editado`,
    commission: '11',
  }, `${suffix}: update sale`, item => item.buyerName.endsWith('Editado') && Number(item.salePrice) === 1100);

  const payable = await createRecord('/api/payables', {
    propertyId: property.id,
    supplierId: supplier.id,
    supplierName: `Fornecedor ${suffix} Editado`,
    product: `Produto ${suffix}`,
    services: '',
    purchaseDate: '2026-01-15',
    amount: '300',
    invoiceDate: '',
    invoiceNumber: '',
    term: '',
    paymentMethod: 'Pix',
    dueDate: '2026-01-30',
    status: 'open',
    observation: 'Parcela de teste',
    installmentNumber: 1,
    installmentTotal: 2,
  }, `${suffix}: create payable`);

  await updateRecord('/api/payables', {
    ...payable,
    product: `Produto ${suffix} Pago`,
    status: 'paid',
  }, `${suffix}: mark payable as paid`, item => item.product.endsWith('Pago') && item.status === 'paid');

  const invoice = await createRecord('/api/invoices', {
    propertyId: property.id,
    supplierId: supplier.id,
    clientName: '',
    number: '',
    issueDate: '',
    dueDate: '',
    amount: '',
    status: 'open',
    type: 'payable',
    description: `Nota ${suffix}`,
  }, `${suffix}: create invoice`);

  await updateRecord('/api/invoices', {
    ...invoice,
    status: 'paid',
    description: `Nota ${suffix} Paga`,
  }, `${suffix}: mark invoice as paid`, item => item.description.endsWith('Paga') && item.status === 'paid');

  const employee = await createRecord('/api/employees', {
    name: `Funcionario ${suffix}`,
    role: 'Obra',
    phone: '',
    email: '',
    document: '',
    status: 'active',
    notes: '',
  }, `${suffix}: create employee`);

  await updateRecord('/api/employees', {
    ...employee,
    name: `Funcionario ${suffix} Inativo`,
    status: 'inactive',
  }, `${suffix}: mark employee inactive`, item => item.name.endsWith('Inativo') && item.status === 'inactive');

  const receivable = await createRecord('/api/receivables', {
    propertyId: property.id,
    clientName: `Cliente ${suffix}`,
    description: `Receber ${suffix}`,
    amount: '450',
    issueDate: '',
    dueDate: '2026-02-05',
    receivedDate: '',
    status: 'open',
    paymentMethod: '',
    observation: '',
  }, `${suffix}: create receivable`);

  await updateRecord('/api/receivables', {
    ...receivable,
    status: 'received',
    receivedDate: '2026-02-04',
  }, `${suffix}: mark receivable as received`, item => item.status === 'received' && item.receivedDate === '2026-02-04');

  const budget = await createRecord('/api/budgets', {
    propertyId: property.id,
    clientName: '',
    title: `Orcamento ${suffix}`,
    description: '',
    amount: '700',
    validUntil: '',
    status: 'draft',
    observation: '',
  }, `${suffix}: create budget`);

  await updateRecord('/api/budgets', {
    ...budget,
    title: `Orcamento ${suffix} Aprovado`,
    status: 'approved',
  }, `${suffix}: approve budget`, item => item.title.endsWith('Aprovado') && item.status === 'approved');

  const protectedDelete = await del(`/api/properties?id=${property.id}`);
  expectStatus(`${suffix}: property remains protected while linked data exists`, protectedDelete.status, 409);
  await expectVisible('/api/properties', property.id, `${suffix}: protected property remains visible`);

  const supplierProtectedDelete = await del(`/api/suppliers?id=${supplier.id}`);
  expectStatus(`${suffix}: supplier remains protected while linked data exists`, supplierProtectedDelete.status, 409);
  await expectVisible('/api/suppliers', supplier.id, `${suffix}: protected supplier remains visible`);

  await deleteRecord('/api/payables', payable.id, `${suffix}: delete payable permanently`);
  await deleteRecord('/api/invoices', invoice.id, `${suffix}: delete invoice permanently`);
  await deleteRecord('/api/sales', sale.id, `${suffix}: delete sale permanently`);
  await deleteRecord('/api/expenses', expense.id, `${suffix}: delete expense permanently`);
  await deleteRecord('/api/receivables', receivable.id, `${suffix}: delete receivable permanently`);
  await deleteRecord('/api/budgets', budget.id, `${suffix}: delete budget permanently`);
  await deleteRecord('/api/employees', employee.id, `${suffix}: delete employee permanently`);
  await deleteRecord('/api/suppliers', supplier.id, `${suffix}: delete supplier permanently`);
  await deleteRecord('/api/properties', property.id, `${suffix}: delete property permanently`);

  logOk(`${suffix}: full create/update/visibility/delete cycle`);
};

(async () => {
  try {
    await waitForServer();

    const setup = await post('/api/auth/setup', {
      username: 'admin',
      displayName: 'Admin CRUD',
      password: '123456',
    });
    expectStatus('first user setup', setup.status, 200);

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await runCrudCycle(cycle);
    }

    const backupDb = path.join(backupDir, 'danix.db');
    expect(fs.existsSync(backupDb), 'Backup database copy was not created.');
    logOk('backup database copy exists during CRUD operations');
  } finally {
    server.kill();
    await delay(500);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
})().catch(error => {
  server.kill();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
