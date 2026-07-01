import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const defaultAppDataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "local-data");
const appDataDir = process.env.APP_DATA_DIR ?? defaultAppDataDir;
const legacyDatabasePath = path.join(appDataDir, "imobcontrol.db");
const databasePath = process.env.DATABASE_PATH ?? path.join(appDataDir, "danix.db");
const backupDatabaseDir = process.env.BACKUP_DATABASE_DIR;
const backupDatabasePath = backupDatabaseDir ? path.join(backupDatabaseDir, "danix.db") : null;

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
if (backupDatabaseDir) {
  fs.mkdirSync(backupDatabaseDir, { recursive: true });
}

if (!process.env.DATABASE_PATH && !fs.existsSync(databasePath) && fs.existsSync(legacyDatabasePath)) {
  fs.copyFileSync(legacyDatabasePath, databasePath);
  for (const suffix of ["-wal", "-shm"]) {
    const legacySidecar = `${legacyDatabasePath}${suffix}`;
    if (fs.existsSync(legacySidecar)) {
      fs.copyFileSync(legacySidecar, `${databasePath}${suffix}`);
    }
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __danixSqlite?: Database.Database;
};

const sqlite =
  globalForDb.__danixSqlite ??
  new Database(databasePath, {
    fileMustExist: false,
  });

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    recovery_code_hash TEXT,
    export_logo_data TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER REFERENCES users(id),
    actor_username TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    purchase_price REAL NOT NULL,
    current_value REAL,
    status TEXT NOT NULL DEFAULT 'owned',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    category TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    purchase_date TEXT NOT NULL,
    invoice_number TEXT,
    invoice_date TEXT,
    invoice_attachment_name TEXT,
    invoice_attachment_type TEXT,
    invoice_attachment_data TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    sale_date TEXT NOT NULL,
    sale_price REAL NOT NULL,
    buyer_name TEXT,
    commission REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT,
    phone TEXT,
    email TEXT,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    observation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    supplier_name TEXT,
    product TEXT,
    services TEXT,
    purchase_date TEXT NOT NULL,
    amount REAL NOT NULL,
    invoice_date TEXT,
    invoice_number TEXT,
    invoice_attachment_name TEXT,
    invoice_attachment_type TEXT,
    invoice_attachment_data TEXT,
    term TEXT,
    payment_method TEXT,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    observation TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    client_name TEXT,
    number TEXT,
    issue_date TEXT,
    due_date TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_data TEXT,
    amount REAL,
    status TEXT NOT NULL DEFAULT 'open',
    type TEXT NOT NULL DEFAULT 'payable',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    document TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    client_name TEXT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    issue_date TEXT,
    due_date TEXT NOT NULL,
    received_date TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    payment_method TEXT,
    observation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    client_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    valid_until TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    observation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const addColumnIfMissing = (tableName: string, columnName: string, definition: string) => {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
  return columns;
};

addColumnIfMissing("properties", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("admin_events", "actor_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("admin_events", "actor_username", "TEXT");
addColumnIfMissing("admin_events", "target_type", "TEXT");
addColumnIfMissing("admin_events", "target_id", "INTEGER");
addColumnIfMissing("admin_events", "details", "TEXT");
addColumnIfMissing("expenses", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("expenses", "invoice_attachment_name", "TEXT");
addColumnIfMissing("expenses", "invoice_attachment_type", "TEXT");
addColumnIfMissing("expenses", "invoice_attachment_data", "TEXT");
addColumnIfMissing("sales", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("suppliers", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("payables", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("payables", "invoice_attachment_name", "TEXT");
addColumnIfMissing("payables", "invoice_attachment_type", "TEXT");
addColumnIfMissing("payables", "invoice_attachment_data", "TEXT");
addColumnIfMissing("users", "export_logo_data", "TEXT");
addColumnIfMissing("payables", "installment_number", "INTEGER");
addColumnIfMissing("payables", "installment_total", "INTEGER");
addColumnIfMissing("invoices", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("invoices", "attachment_name", "TEXT");
addColumnIfMissing("invoices", "attachment_type", "TEXT");
addColumnIfMissing("invoices", "attachment_data", "TEXT");
addColumnIfMissing("employees", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("receivables", "owner_user_id", "INTEGER REFERENCES users(id)");
addColumnIfMissing("budgets", "owner_user_id", "INTEGER REFERENCES users(id)");

const suppliersColumns = sqlite.prepare("PRAGMA table_info(suppliers)").all() as Array<{ name: string }>;
if (!suppliersColumns.some((column) => column.name === "property_id")) {
  sqlite.exec("ALTER TABLE suppliers ADD COLUMN property_id INTEGER REFERENCES properties(id)");
}

const payablesColumns = sqlite.prepare("PRAGMA table_info(payables)").all() as Array<{ name: string }>;
if (!payablesColumns.some((column) => column.name === "property_id")) {
  sqlite.exec("ALTER TABLE payables ADD COLUMN property_id INTEGER REFERENCES properties(id)");
}

if (!payablesColumns.some((column) => column.name === "supplier_name")) {
  sqlite.exec("ALTER TABLE payables ADD COLUMN supplier_name TEXT");
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.__danixSqlite = sqlite;
}

let backupQueue = Promise.resolve();

export function syncDatabaseBackup() {
  if (!backupDatabasePath || path.resolve(backupDatabasePath) === path.resolve(databasePath)) {
    return Promise.resolve();
  }

  backupQueue = backupQueue
    .catch(() => undefined)
    .then(async () => {
      const temporaryBackupPath = `${backupDatabasePath}.tmp`;

      fs.mkdirSync(path.dirname(backupDatabasePath), { recursive: true });
      fs.rmSync(temporaryBackupPath, { force: true });
      await sqlite.backup(temporaryBackupPath);
      fs.renameSync(temporaryBackupPath, backupDatabasePath);
    })
    .catch((error) => {
      console.error("Failed to sync portable database backup", error);
    });

  return backupQueue;
}

void syncDatabaseBackup();

const applicationTables = [
  "users",
  "sessions",
  "admin_events",
  "properties",
  "expenses",
  "sales",
  "suppliers",
  "payables",
  "invoices",
  "employees",
  "receivables",
  "budgets",
];

const getTableColumns = (database: Database.Database, tableName: string) => {
  return (database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(column => column.name);
};

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const quoteString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const validateBackupDatabase = (backupPath: string) => {
  const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = backup.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
    if (integrity.integrity_check !== "ok") {
      throw new Error("integrity_check_failed");
    }

    for (const tableName of applicationTables) {
      const table = backup.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
      if (!table) {
        throw new Error(`missing_table:${tableName}`);
      }
    }
  } finally {
    backup.close();
  }
};

export async function createManualBackup() {
  const backupDir = path.join(appDataDir, "manual-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `danix-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await sqlite.backup(backupPath);
  return backupPath;
}

export async function restoreManualBackup(sourcePath: string) {
  validateBackupDatabase(sourcePath);
  const backup = new Database(sourcePath, { readonly: true, fileMustExist: true });
  const backupColumnsByTable = new Map<string, string[]>();
  try {
    for (const tableName of applicationTables) {
      backupColumnsByTable.set(tableName, getTableColumns(backup, tableName));
    }
  } finally {
    backup.close();
  }

  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec(`ATTACH DATABASE ${quoteString(sourcePath)} AS imported`);

  const transaction = sqlite.transaction(() => {
      for (const tableName of [...applicationTables].reverse()) {
        sqlite.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
      }

      for (const tableName of applicationTables) {
        const currentColumns = getTableColumns(sqlite, tableName);
        const backupColumns = backupColumnsByTable.get(tableName) ?? [];
        const sharedColumns = currentColumns.filter(column => backupColumns.includes(column));
        if (sharedColumns.length === 0) {
          throw new Error(`no_shared_columns:${tableName}`);
        }
        const columnList = sharedColumns.map(quoteIdentifier).join(", ");
        sqlite.exec(`INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) SELECT ${columnList} FROM imported.${quoteIdentifier(tableName)}`);
      }

      sqlite.prepare("DELETE FROM sessions").run();
  });

  try {
    transaction();
  } finally {
    sqlite.exec("DETACH DATABASE imported");
    sqlite.exec("PRAGMA foreign_keys = ON");
  }

  await syncDatabaseBackup();
}

export { databasePath };

export const db = drizzle(sqlite);
