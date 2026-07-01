import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  permissions: text('permissions').notNull(),
  isActive: integer('is_active').notNull().default(1),
  recoveryCodeHash: text('recovery_code_hash'),
  exportLogoData: text('export_logo_data'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const adminEvents = sqliteTable('admin_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorUsername: text('actor_username'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: integer('target_id'),
  details: text('details'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const properties = sqliteTable('properties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  address: text('address').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  purchasePrice: real('purchase_price').notNull(),
  currentValue: real('current_value'),
  status: text('status').notNull().default('owned'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  category: text('category').notNull(),
  item: text('item').notNull(),
  amount: real('amount').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  invoiceNumber: text('invoice_number'),
  invoiceDate: text('invoice_date'),
  invoiceAttachmentName: text('invoice_attachment_name'),
  invoiceAttachmentType: text('invoice_attachment_type'),
  invoiceAttachmentData: text('invoice_attachment_data'),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  saleDate: text('sale_date').notNull(),
  salePrice: real('sale_price').notNull(),
  buyerName: text('buyer_name'),
  commission: real('commission').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  cnpj: text('cnpj'),
  phone: text('phone'),
  email: text('email'),
  category: text('category').notNull(),
  status: text('status').notNull().default('open'),
  observation: text('observation'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payables = sqliteTable('payables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  supplierName: text('supplier_name'),
  product: text('product'),
  services: text('services'),
  purchaseDate: text('purchase_date').notNull(),
  amount: real('amount').notNull(),
  invoiceDate: text('invoice_date'),
  invoiceNumber: text('invoice_number'),
  invoiceAttachmentName: text('invoice_attachment_name'),
  invoiceAttachmentType: text('invoice_attachment_type'),
  invoiceAttachmentData: text('invoice_attachment_data'),
  term: text('term'),
  paymentMethod: text('payment_method'),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('open'),
  observation: text('observation'),
  installmentNumber: integer('installment_number'),
  installmentTotal: integer('installment_total'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  clientName: text('client_name'),
  number: text('number'),
  issueDate: text('issue_date'),
  dueDate: text('due_date'),
  attachmentName: text('attachment_name'),
  attachmentType: text('attachment_type'),
  attachmentData: text('attachment_data'),
  amount: real('amount'),
  status: text('status').notNull().default('open'),
  type: text('type').notNull().default('payable'),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  role: text('role'),
  phone: text('phone'),
  email: text('email'),
  document: text('document'),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const receivables = sqliteTable('receivables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  clientName: text('client_name'),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  issueDate: text('issue_date'),
  dueDate: text('due_date').notNull(),
  receivedDate: text('received_date'),
  status: text('status').notNull().default('open'),
  paymentMethod: text('payment_method'),
  observation: text('observation'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  propertyId: integer('property_id').references(() => properties.id),
  clientName: text('client_name'),
  title: text('title').notNull(),
  description: text('description'),
  amount: real('amount').notNull(),
  validUntil: text('valid_until'),
  status: text('status').notNull().default('draft'),
  observation: text('observation'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const propertiesRelations = relations(properties, ({ many, one }) => ({
  owner: one(users, {
    fields: [properties.ownerUserId],
    references: [users.id],
  }),
  expenses: many(expenses),
  sales: many(sales),
  suppliers: many(suppliers),
  payables: many(payables),
  invoices: many(invoices),
  receivables: many(receivables),
  budgets: many(budgets),
}));

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  expenses: many(expenses),
  sales: many(sales),
  suppliers: many(suppliers),
  payables: many(payables),
  invoices: many(invoices),
  employees: many(employees),
  receivables: many(receivables),
  budgets: many(budgets),
  sessions: many(sessions),
  adminEvents: many(adminEvents),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const adminEventsRelations = relations(adminEvents, ({ one }) => ({
  actor: one(users, {
    fields: [adminEvents.actorUserId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  owner: one(users, {
    fields: [expenses.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [expenses.propertyId],
    references: [properties.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  owner: one(users, {
    fields: [sales.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [sales.propertyId],
    references: [properties.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many, one }) => ({
  payables: many(payables),
  owner: one(users, {
    fields: [suppliers.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [suppliers.propertyId],
    references: [properties.id],
  }),
}));

export const payablesRelations = relations(payables, ({ one }) => ({
  owner: one(users, {
    fields: [payables.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [payables.propertyId],
    references: [properties.id],
  }),
  supplier: one(suppliers, {
    fields: [payables.supplierId],
    references: [suppliers.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  owner: one(users, {
    fields: [invoices.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [invoices.propertyId],
    references: [properties.id],
  }),
  supplier: one(suppliers, {
    fields: [invoices.supplierId],
    references: [suppliers.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one }) => ({
  owner: one(users, {
    fields: [employees.ownerUserId],
    references: [users.id],
  }),
}));

export const receivablesRelations = relations(receivables, ({ one }) => ({
  owner: one(users, {
    fields: [receivables.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [receivables.propertyId],
    references: [properties.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  owner: one(users, {
    fields: [budgets.ownerUserId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [budgets.propertyId],
    references: [properties.id],
  }),
}));

export type Property = typeof properties.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Payable = typeof payables.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Receivable = typeof receivables.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AdminEvent = typeof adminEvents.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type NewExpense = typeof expenses.$inferInsert;
export type NewSale = typeof sales.$inferInsert;
export type NewSupplier = typeof suppliers.$inferInsert;
export type NewPayable = typeof payables.$inferInsert;
export type NewInvoice = typeof invoices.$inferInsert;
export type NewEmployee = typeof employees.$inferInsert;
export type NewReceivable = typeof receivables.$inferInsert;
export type NewBudget = typeof budgets.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewSession = typeof sessions.$inferInsert;
export type NewAdminEvent = typeof adminEvents.$inferInsert;
