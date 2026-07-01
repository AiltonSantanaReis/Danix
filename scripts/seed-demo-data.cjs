const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const marker = 'DEMO DANIX';
const root = path.resolve(__dirname, '..');
const defaultDatabasePath = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'Danix', 'danix.db')
  : path.join(root, 'local-data', 'danix.db');
const databasePath = process.env.DATABASE_PATH || defaultDatabasePath;
const backupDatabasePath = process.env.BACKUP_DATABASE_PATH || path.join(root, 'dist-portable-ready', 'win-unpacked', 'database', 'danix.db');
const shouldRemoveOnly = process.argv.includes('--remove');

if (!fs.existsSync(databasePath)) {
  throw new Error(`Banco nao encontrado: ${databasePath}`);
}

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const getColumns = table => db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
const hasTable = table => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);

const requiredTables = [
  'users',
  'properties',
  'expenses',
  'sales',
  'suppliers',
  'payables',
  'invoices',
  'employees',
  'receivables',
  'budgets',
];

for (const table of requiredTables) {
  if (!hasTable(table)) throw new Error(`Tabela obrigatoria ausente: ${table}`);
}

const tableColumns = Object.fromEntries(requiredTables.map(table => [table, getColumns(table)]));

const getActiveUser = () => {
  const forcedUserId = Number(process.env.DEMO_USER_ID || '');
  if (Number.isInteger(forcedUserId) && forcedUserId > 0) {
    return db.prepare('SELECT id, username, display_name AS displayName FROM users WHERE id = ? AND is_active = 1').get(forcedUserId);
  }

  return db
    .prepare("SELECT id, username, display_name AS displayName FROM users WHERE is_active = 1 ORDER BY role = 'admin' DESC, id ASC LIMIT 1")
    .get();
};

const insert = (table, values) => {
  const columns = Object.keys(values).filter(column => tableColumns[table].includes(column));
  const placeholders = columns.map(column => `@${column}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return db.prepare(sql).run(values).lastInsertRowid;
};

const removeDemoData = () => {
  db.prepare(`DELETE FROM budgets WHERE title LIKE ? OR description LIKE ? OR observation LIKE ?`).run(`${marker}%`, `%${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM receivables WHERE description LIKE ? OR client_name LIKE ? OR observation LIKE ?`).run(`${marker}%`, `${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM employees WHERE name LIKE ? OR notes LIKE ?`).run(`${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM invoices WHERE description LIKE ? OR client_name LIKE ?`).run(`${marker}%`, `${marker}%`);
  db.prepare(`DELETE FROM payables WHERE product LIKE ? OR services LIKE ? OR observation LIKE ? OR supplier_name LIKE ?`).run(`${marker}%`, `${marker}%`, `%${marker}%`, `${marker}%`);
  db.prepare(`DELETE FROM sales WHERE buyer_name LIKE ? OR notes LIKE ?`).run(`${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM expenses WHERE item LIKE ? OR description LIKE ?`).run(`${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM suppliers WHERE legal_name LIKE ? OR trade_name LIKE ? OR observation LIKE ?`).run(`${marker}%`, `${marker}%`, `%${marker}%`);
  db.prepare(`DELETE FROM properties WHERE name LIKE ? OR address LIKE ?`).run(`${marker}%`, `${marker}%`);
};

const syncBackup = async () => {
  if (!backupDatabasePath || path.resolve(backupDatabasePath) === path.resolve(databasePath)) return;
  fs.mkdirSync(path.dirname(backupDatabasePath), { recursive: true });
  const temporaryBackupPath = `${backupDatabasePath}.tmp`;
  fs.rmSync(temporaryBackupPath, { force: true });
  await db.backup(temporaryBackupPath);
  fs.renameSync(temporaryBackupPath, backupDatabasePath);
};

const seedDemoData = user => {
  const ownerUserId = user.id;

  const propertyAurora = insert('properties', {
    owner_user_id: ownerUserId,
    name: `${marker} - Residencial Aurora`,
    address: `${marker} - Rua das Palmeiras, 120`,
    purchase_date: '2026-01-08',
    purchase_price: 0,
    current_value: null,
    status: 'owned',
  });

  const propertyCentro = insert('properties', {
    owner_user_id: ownerUserId,
    name: `${marker} - Reforma Centro`,
    address: `${marker} - Avenida Brasil, 450`,
    purchase_date: '2026-02-12',
    purchase_price: 0,
    current_value: null,
    status: 'under_reform',
  });

  const propertyPrime = insert('properties', {
    owner_user_id: ownerUserId,
    name: `${marker} - Sala Comercial Prime`,
    address: `${marker} - Alameda dos Negocios, 88`,
    purchase_date: '2026-03-05',
    purchase_price: 0,
    current_value: null,
    status: 'owned',
  });

  const supplierObra = insert('suppliers', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    legal_name: `${marker} - Construtora Modelo Ltda`,
    trade_name: `${marker} Obras`,
    cnpj: '12.345.678/0001-90',
    phone: '(11) 4002-8922',
    email: '',
    category: 'Obra',
    status: 'open',
    observation: `${marker} - fornecedor ficticio para visualizacao`,
  });

  const supplierAcabamento = insert('suppliers', {
    owner_user_id: ownerUserId,
    property_id: propertyCentro,
    legal_name: `${marker} - Acabamentos Sul Ltda`,
    trade_name: `${marker} Acabamentos`,
    cnpj: '98.765.432/0001-10',
    phone: '(21) 3003-1010',
    email: 'financeiro@demo.local',
    category: 'Materiais',
    status: 'paid',
    observation: `${marker} - exemplo com e-mail preenchido`,
  });

  insert('expenses', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    category: 'Materiais',
    item: `${marker} - Cimento e areia`,
    amount: 1850.75,
    purchase_date: '2026-06-01',
    invoice_number: 'NF-DEMO-1001',
    invoice_date: '2026-06-01',
    description: `${marker} - despesa direta vinculada ao imovel`,
  });

  insert('expenses', {
    owner_user_id: ownerUserId,
    property_id: propertyCentro,
    category: 'Mao de obra',
    item: `${marker} - Pintura interna`,
    amount: 3200,
    purchase_date: '2026-06-04',
    invoice_number: '',
    invoice_date: '',
    description: `${marker} - exemplo sem nota fiscal preenchida`,
  });

  insert('payables', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    supplier_id: supplierObra,
    supplier_name: `${marker} Obras`,
    product: `${marker} - Kit hidraulico`,
    services: '',
    purchase_date: '2026-06-03',
    amount: 970.5,
    invoice_date: '',
    invoice_number: '',
    term: '12 dias',
    payment_method: 'Pix',
    due_date: '2026-06-30',
    status: 'open',
    observation: `${marker} - conta pendente`,
    installment_number: 1,
    installment_total: 2,
  });

  insert('payables', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    supplier_id: supplierObra,
    supplier_name: `${marker} Obras`,
    product: `${marker} - Kit hidraulico`,
    services: '',
    purchase_date: '2026-06-03',
    amount: 970.5,
    invoice_date: '',
    invoice_number: '',
    term: '42 dias',
    payment_method: 'Pix',
    due_date: '2026-07-30',
    status: 'paid',
    observation: `${marker} - conta paga que deve continuar visivel`,
    installment_number: 2,
    installment_total: 2,
  });

  insert('payables', {
    owner_user_id: ownerUserId,
    property_id: propertyCentro,
    supplier_id: supplierAcabamento,
    supplier_name: `${marker} Acabamentos`,
    product: '',
    services: `${marker} - Aplicacao de porcelanato`,
    purchase_date: '2026-05-20',
    amount: 2450,
    invoice_date: '2026-05-21',
    invoice_number: 'REC-DEMO-221',
    term: '0 dias',
    payment_method: 'Boleto',
    due_date: '2026-06-10',
    status: 'overdue',
    observation: `${marker} - conta atrasada para painel`,
    installment_number: null,
    installment_total: null,
  });

  insert('invoices', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    supplier_id: supplierObra,
    client_name: '',
    number: 'NF-DEMO-2001',
    issue_date: '2026-06-02',
    due_date: '2026-06-30',
    amount: 1941,
    status: 'open',
    type: 'payable',
    description: `${marker} - Nota de materiais hidraulicos`,
  });

  insert('employees', {
    owner_user_id: ownerUserId,
    name: `${marker} - Carlos Andrade`,
    role: 'Pedreiro',
    phone: '(11) 98888-1000',
    email: '',
    document: '000.000.000-00',
    status: 'active',
    notes: `${marker} - funcionario ficticio ativo`,
  });

  insert('employees', {
    owner_user_id: ownerUserId,
    name: `${marker} - Marina Costa`,
    role: 'Pintora',
    phone: '(11) 97777-2000',
    email: 'marina@demo.local',
    document: '111.111.111-11',
    status: 'inactive',
    notes: `${marker} - funcionario inativo ainda visivel`,
  });

  insert('receivables', {
    owner_user_id: ownerUserId,
    property_id: propertyPrime,
    client_name: `${marker} - Cliente Alfa`,
    description: `${marker} - Aluguel comercial`,
    amount: 4200,
    issue_date: '2026-06-05',
    due_date: '2026-06-25',
    received_date: '',
    status: 'open',
    payment_method: 'Transferencia',
    observation: `${marker} - valor a receber pendente`,
  });

  insert('receivables', {
    owner_user_id: ownerUserId,
    property_id: propertyPrime,
    client_name: `${marker} - Cliente Beta`,
    description: `${marker} - Reembolso de manutencao`,
    amount: 680,
    issue_date: '2026-06-06',
    due_date: '2026-06-12',
    received_date: '2026-06-12',
    status: 'received',
    payment_method: 'Pix',
    observation: `${marker} - recebido e ainda visivel`,
  });

  insert('budgets', {
    owner_user_id: ownerUserId,
    property_id: propertyCentro,
    client_name: `${marker} - Cliente Reforma`,
    title: `${marker} - Orcamento pintura fachada`,
    description: 'Pintura externa, limpeza e reparos leves',
    amount: 7600,
    valid_until: '2026-07-15',
    status: 'sent',
    observation: `${marker} - aguardando aprovacao`,
  });

  insert('budgets', {
    owner_user_id: ownerUserId,
    property_id: propertyAurora,
    client_name: '',
    title: `${marker} - Orcamento eletrica final`,
    description: 'Revisao eletrica e instalacao de luminarias',
    amount: 2950,
    valid_until: '',
    status: 'approved',
    observation: `${marker} - aprovado para exemplo`,
  });

  insert('sales', {
    owner_user_id: ownerUserId,
    property_id: null,
    sale_date: '2026-06-15',
    sale_price: 185000,
    buyer_name: `${marker} - Comprador Exemplo`,
    commission: 3700,
    notes: `${marker} - venda ficticia sem vinculo para testar aba vendas`,
  });
};

const countDemoData = () => ({
  properties: db.prepare("SELECT COUNT(*) AS count FROM properties WHERE name LIKE ?").get(`${marker}%`).count,
  suppliers: db.prepare("SELECT COUNT(*) AS count FROM suppliers WHERE legal_name LIKE ?").get(`${marker}%`).count,
  expenses: db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE item LIKE ?").get(`${marker}%`).count,
  payables: db.prepare("SELECT COUNT(*) AS count FROM payables WHERE product LIKE ? OR services LIKE ?").get(`${marker}%`, `${marker}%`).count,
  invoices: db.prepare("SELECT COUNT(*) AS count FROM invoices WHERE description LIKE ?").get(`${marker}%`).count,
  employees: db.prepare("SELECT COUNT(*) AS count FROM employees WHERE name LIKE ?").get(`${marker}%`).count,
  receivables: db.prepare("SELECT COUNT(*) AS count FROM receivables WHERE description LIKE ?").get(`${marker}%`).count,
  budgets: db.prepare("SELECT COUNT(*) AS count FROM budgets WHERE title LIKE ?").get(`${marker}%`).count,
  sales: db.prepare("SELECT COUNT(*) AS count FROM sales WHERE buyer_name LIKE ?").get(`${marker}%`).count,
});

const transaction = db.transaction(() => {
  const user = getActiveUser();
  if (!user) {
    throw new Error('Nenhum usuario ativo encontrado. Abra o Danix e crie o primeiro usuario antes de gerar dados ficticios.');
  }

  removeDemoData();
  if (!shouldRemoveOnly) seedDemoData(user);
  return user;
});

(async () => {
  const user = transaction();
  await syncBackup();

  if (shouldRemoveOnly) {
    console.log(`Dados ficticios removidos do banco ${databasePath}.`);
  } else {
    console.log(`Dados ficticios adicionados para o usuario ${user.username} (${user.displayName}).`);
    console.log(`Banco principal: ${databasePath}`);
    console.log(`Copia sincronizada: ${backupDatabasePath}`);
    console.log(`Resumo: ${JSON.stringify(countDemoData())}`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  db.close();
});
