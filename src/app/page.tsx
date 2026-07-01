'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Home, DollarSign, TrendingUp, BarChart3, 
  FileText, Trash2, Edit2, Building2, ClipboardList, Search, PieChart, Lock, LogOut, UserCog, EyeOff, Download, Upload, AlertTriangle
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildCustomPdfHtml, buildExcelWorkbookXlsx, buildExcelWorkbookXml, buildExportReportHtml, type CustomPdfItem } from './exportReport';

interface Property {
  id: number;
  ownerUserId?: number;
  name: string;
  address: string;
  purchaseDate: string;
  purchasePrice: string;
  currentValue?: string;
  status: string;
}

interface Expense {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  category: string;
  item: string;
  amount: string;
  purchaseDate: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAttachmentName?: string;
  invoiceAttachmentType?: string;
  invoiceAttachmentData?: string;
  description?: string;
}

interface Sale {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  saleDate: string;
  salePrice: string;
  buyerName?: string;
  commission?: string;
  notes?: string;
}

interface Supplier {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  legalName: string;
  tradeName?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  category: string;
  status: string;
  observation?: string;
}

interface Payable {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  supplierId?: number;
  supplierName?: string;
  product?: string;
  services?: string;
  purchaseDate: string;
  amount: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceAttachmentName?: string;
  invoiceAttachmentType?: string;
  invoiceAttachmentData?: string;
  term?: string;
  paymentMethod?: string;
  dueDate: string;
  status: string;
  observation?: string;
  installmentNumber?: number;
  installmentTotal?: number;
}

interface Invoice {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  supplierId?: number;
  clientName?: string;
  number?: string;
  issueDate?: string;
  dueDate?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentData?: string;
  amount?: string;
  status: string;
  type: string;
  description?: string;
}

type InvoiceListItem = Invoice & {
  listId: string;
  source: 'manual' | 'expense' | 'payable';
  sourceLabel: string;
  sourceId: number;
  attachmentName?: string;
  attachmentType?: string;
  attachmentData?: string;
};

interface Employee {
  id: number;
  ownerUserId?: number;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  document?: string;
  status: string;
  notes?: string;
}

interface Receivable {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  clientName?: string;
  description: string;
  amount: string;
  issueDate?: string;
  dueDate: string;
  receivedDate?: string;
  status: string;
  paymentMethod?: string;
  observation?: string;
}

interface Budget {
  id: number;
  ownerUserId?: number;
  propertyId?: number;
  clientName?: string;
  title: string;
  description?: string;
  amount: string;
  validUntil?: string;
  status: string;
  observation?: string;
}

type PermissionKey = 'dashboard' | 'properties' | 'expenses' | 'sales' | 'suppliers' | 'payables' | 'invoices' | 'employees' | 'receivables' | 'budgets' | 'analysis' | 'export' | 'recoverUsers' | 'users' | 'viewAllData';
type PermissionMap = Record<PermissionKey, boolean>;

interface AppUser {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user' | string;
  permissions: PermissionMap;
  isActive: boolean;
  exportLogoData?: string | null;
}

const PERMISSION_ORDER: PermissionKey[] = ['dashboard', 'properties', 'expenses', 'sales', 'suppliers', 'payables', 'invoices', 'employees', 'receivables', 'budgets', 'analysis', 'export', 'recoverUsers', 'users', 'viewAllData'];

const CATEGORIES = [
  'Imóveis', 'Móveis e Eletrodomésticos', 'Reforma e Construção', 
  'Prestadores de Serviços', 'Marketing e Vendas', 'Manutenção', 
  'Impostos e Taxas', 'Seguros', 'Utilidades', 'Outros'
];

const SUPPLIER_CATEGORIES = [
  'Materiais', 'Mão de Obra', 'Prestadores', 'Marketing', 'Impostos', 'Serviços', 'Outros'
];

const PAYMENT_METHODS = [
  'Pix', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Dinheiro', 'Outro'
];

const emptyPropertyForm = {
  name: '',
  address: '',
  purchaseDate: '',
  purchasePrice: '',
  currentValue: '',
  status: 'owned',
};

const emptySupplierForm = {
  propertyId: '',
  legalName: '',
  tradeName: '',
  cnpj: '',
  phone: '',
  email: '',
  category: '',
  status: 'open',
  observation: '',
};

const emptyInvoiceForm = {
  propertyId: '',
  supplierId: '',
  clientName: '',
  number: '',
  issueDate: '',
  dueDate: '',
  amount: '',
  status: 'open',
  type: 'payable',
  description: '',
};

const emptyEmployeeForm = {
  name: '',
  role: '',
  phone: '',
  email: '',
  document: '',
  status: 'active',
  notes: '',
};

const emptyReceivableForm = {
  propertyId: '',
  clientName: '',
  description: '',
  amount: '',
  issueDate: '',
  dueDate: format(new Date(), 'yyyy-MM-dd'),
  receivedDate: '',
  status: 'open',
  paymentMethod: PAYMENT_METHODS[0],
  observation: '',
};

const emptyBudgetForm = {
  propertyId: '',
  clientName: '',
  title: '',
  description: '',
  amount: '',
  validUntil: '',
  status: 'draft',
  observation: '',
};

const emptyPayableForm = {
  propertyId: '',
  supplierId: '',
  supplierName: '',
  product: '',
  services: '',
  purchaseDate: format(new Date(), 'yyyy-MM-dd'),
  amount: '',
  invoiceDate: '',
  invoiceNumber: '',
  term: '',
  paymentMethod: PAYMENT_METHODS[0],
  dueDate: format(new Date(), 'yyyy-MM-dd'),
  status: 'open',
  observation: '',
  installmentNumber: '',
  installmentTotal: '1',
  installmentDates: '',
};

const emptyUserForm = {
  id: 0,
  username: '',
  displayName: '',
  password: '',
  role: 'user',
  isActive: true,
  permissions: Object.fromEntries(PERMISSION_ORDER.map(permission => [permission, permission !== 'users' && permission !== 'recoverUsers' && permission !== 'viewAllData'])) as PermissionMap,
};

const customPdfExampleItems = [
  'Projeto executivo e acompanhamento | 1 | R$ 1.500,00 | R$ 1.500,00',
  'Materiais e acabamentos | 1 | R$ 3.200,00 | R$ 3.200,00',
  'Mao de obra especializada | 1 | R$ 2.800,00 | R$ 2.800,00',
].join('\n');

const emptyCustomPdfForm = {
  documentTitle: 'Orcamento',
  clientName: '',
  reference: '',
  propertyId: '',
  documentDate: format(new Date(), 'yyyy-MM-dd'),
  validUntil: '',
  introduction: 'Conforme solicitado, apresentamos a proposta abaixo para avaliacao e aprovacao.',
  itemsText: '',
  paymentTerms: 'Forma de pagamento a combinar.',
  notes: 'Valores sujeitos a alteracao conforme escopo final aprovado.',
  signerLeft: 'Contratante',
  signerRight: 'Contratada',
  signerThird: '',
};

const parseLocalDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isValidDateInput = (date?: string) => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));

const calculateTermFromToday = (dueDate?: string) => {
  if (!isValidDateInput(dueDate)) return '';
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = parseLocalDate(dueDate || '');
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (diffDays === 0) return 'vence hoje';
  if (diffDays === 1) return '1 dia';
  if (diffDays === -1) return '1 dia atrasado';
  return diffDays > 0 ? `${diffDays} dias` : `${Math.abs(diffDays)} dias atrasado`;
};

const addMonthsToDateInput = (date: string, months: number) => {
  const base = parseLocalDate(date);
  base.setMonth(base.getMonth() + months);
  return format(base, 'yyyy-MM-dd');
};

type UnifiedCostEntry = {
  label: string;
  amount: number;
  date: string;
  source: string;
  category: string;
  supplierName?: string;
};

const buildUnifiedCostEntries = (expensesList: Expense[], payablesList: Payable[], suppliersList: Supplier[]) => {
  const expenseEntries: UnifiedCostEntry[] = expensesList.map(expense => ({
    label: expense.item || 'Despesa sem descricao',
    amount: parseFloat(expense.amount || '0'),
    date: expense.purchaseDate,
    source: 'Despesa',
    category: expense.category || 'Despesas sem categoria',
  }));

  const payableEntries: UnifiedCostEntry[] = payablesList.map(payable => {
    const supplier = suppliersList.find(item => item.id === payable.supplierId);
    return {
      label: payable.product || payable.services || 'Conta sem descricao',
      amount: parseFloat(payable.amount || '0'),
      date: payable.purchaseDate,
      source: 'Conta a pagar',
      category: payable.product ? 'Produtos' : payable.services ? 'Servicos' : 'Contas a pagar',
      supplierName: supplier?.tradeName || supplier?.legalName || payable.supplierName || 'Sem fornecedor',
    };
  });

  return [...expenseEntries, ...payableEntries].filter(entry => Number.isFinite(entry.amount) && entry.amount >= 0);
};

const buildUnifiedCostAnalysis = (entries: UnifiedCostEntry[]) => {
  const grouped = entries.reduce((acc, entry) => {
    const label = entry.label || 'Sem descricao';

    if (!acc[label]) {
      acc[label] = {
        label,
        total: 0,
        count: 0,
        suppliers: new Set<string>(),
        lastPurchaseDate: entry.date,
      };
    }

    acc[label].total += entry.amount;
    acc[label].count += 1;
    acc[label].suppliers.add(entry.supplierName || entry.source);
    if (parseLocalDate(entry.date) > parseLocalDate(acc[label].lastPurchaseDate)) {
      acc[label].lastPurchaseDate = entry.date;
    }

    return acc;
  }, {} as Record<string, { label: string; total: number; count: number; suppliers: Set<string>; lastPurchaseDate: string }>);

  const total = Object.values(grouped).reduce((sum, item) => sum + item.total, 0);

  return Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .map(item => ({
      ...item,
      suppliers: Array.from(item.suppliers).join(', ') || 'Sem origem',
      percentage: total > 0 ? (item.total / total) * 100 : 0,
    }));
};

function EmptyState({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="empty-state-action">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function Danix() {
  type ActiveTab = 'dashboard' | 'properties' | 'expenses' | 'sales' | 'suppliers' | 'payables' | 'invoices' | 'employees' | 'receivables' | 'budgets' | 'analysis' | 'users';
  type DataFormKey = 'property' | 'expense' | 'sale' | 'supplier' | 'payable' | 'invoice' | 'employee' | 'receivable' | 'budget';
  type AppTheme = 'light-blue' | 'dark';
  type DashboardWidgetKey = 'kpis' | 'charts' | 'categories' | 'properties' | 'recent';
  const dashboardWidgetLabels: Record<DashboardWidgetKey, string> = {
    kpis: 'Indicadores',
    charts: 'Graficos',
    categories: 'Categorias',
    properties: 'Imoveis',
    recent: 'Atividade',
  };
  const defaultDashboardWidgets: Record<DashboardWidgetKey, boolean> = {
    kpis: true,
    charts: true,
    categories: true,
    properties: true,
    recent: true,
  };
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [locked, setLocked] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'setup' | 'recover'>('login');
  const [authForm, setAuthForm] = useState({ username: '', displayName: '', password: '', newPassword: '', recoveryCode: '' });
  const [lastRecoveryCode, setLastRecoveryCode] = useState('');
  const [permissionLabels, setPermissionLabels] = useState<Record<string, string>>({});
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState(emptyUserForm);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingInvoiceAttachment, setPendingInvoiceAttachment] = useState<InvoiceListItem | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [dateRange, setDateRange] = useState<{from: string, to: string}>({
    from: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  const [excelExportFormat, setExcelExportFormat] = useState<'xlsx' | 'xml'>('xlsx');
  const [customPdfOpen, setCustomPdfOpen] = useState(false);
  const [customPdfForm, setCustomPdfForm] = useState(emptyCustomPdfForm);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [propertyDetailId, setPropertyDetailId] = useState<number | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<'all' | 'owned' | 'under_reform' | 'sold'>('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseQuickFilter, setExpenseQuickFilter] = useState<'all' | 'linked' | 'unlinked' | 'invoice'>('all');
  const [saleSearch, setSaleSearch] = useState('');
  const [saleQuickFilter, setSaleQuickFilter] = useState<'all' | 'linked' | 'unlinked' | 'buyer'>('all');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState<'all' | 'open' | 'paid' | 'overdue'>('all');
  const [accountSearch, setAccountSearch] = useState('');
  const [payableStatusFilter, setPayableStatusFilter] = useState<'all' | 'open' | 'paid' | 'overdue'>('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'open' | 'paid' | 'overdue' | 'canceled'>('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [receivableSearch, setReceivableSearch] = useState('');
  const [receivablePeriod, setReceivablePeriod] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'all' | 'draft' | 'sent' | 'approved' | 'rejected'>('all');
  const [openDataForm, setOpenDataForm] = useState<DataFormKey | null>(null);
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light-blue';
    const savedTheme = window.localStorage.getItem('danix-app-theme');
    return savedTheme === 'dark' || savedTheme === 'light-blue' ? savedTheme : 'light-blue';
  });
  const [dashboardWidgets, setDashboardWidgets] = useState<Record<DashboardWidgetKey, boolean>>(() => {
    if (typeof window === 'undefined') return defaultDashboardWidgets;
    try {
      const savedWidgets = window.localStorage.getItem('danix-dashboard-widgets');
      return savedWidgets ? { ...defaultDashboardWidgets, ...JSON.parse(savedWidgets) } : defaultDashboardWidgets;
    } catch {
      return defaultDashboardWidgets;
    }
  });

  // Form states
  const [newProperty, setNewProperty] = useState(emptyPropertyForm);
  const [newSupplier, setNewSupplier] = useState(emptySupplierForm);
  const [newPayable, setNewPayable] = useState(emptyPayableForm);
  const [newInvoice, setNewInvoice] = useState(emptyInvoiceForm);
  const [newEmployee, setNewEmployee] = useState(emptyEmployeeForm);
  const [newReceivable, setNewReceivable] = useState(emptyReceivableForm);
  const [newBudget, setNewBudget] = useState(emptyBudgetForm);
  const [budgetPropertyInput, setBudgetPropertyInput] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [newExpense, setNewExpense] = useState({
    propertyId: '',
    category: '',
    item: '',
    amount: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    invoiceNumber: '',
    invoiceDate: '',
    description: ''
  });
  const [newSale, setNewSale] = useState({
    propertyId: '',
    saleDate: format(new Date(), 'yyyy-MM-dd'),
    salePrice: '',
    buyerName: '',
    commission: '',
    notes: ''
  });

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string } | null>(null);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const requestConfirmation = (message: string) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmDialog({ message });
    });
  };

  const closeConfirmation = (confirmed: boolean) => {
    confirmResolver.current?.(confirmed);
    confirmResolver.current = null;
    setConfirmDialog(null);
  };

  const releaseActiveElement = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const dataFormTitle = (form: DataFormKey) => {
    switch (form) {
      case 'property': return editingProperty ? 'Editar imóvel' : 'Adicionar imóvel';
      case 'expense': return editingExpense ? 'Editar despesa' : 'Adicionar despesa';
      case 'sale': return editingSale ? 'Editar venda' : 'Registrar venda';
      case 'supplier': return editingSupplier ? 'Editar fornecedor' : 'Adicionar fornecedor';
      case 'payable': return editingPayable ? 'Editar conta a pagar' : 'Adicionar conta a pagar';
      case 'invoice': return editingInvoice ? 'Editar nota fiscal' : 'Adicionar nota fiscal';
      case 'employee': return editingEmployee ? 'Editar funcionário' : 'Adicionar funcionário';
      case 'receivable': return editingReceivable ? 'Editar conta a receber' : 'Adicionar conta a receber';
      case 'budget': return editingBudget ? 'Editar orçamento' : 'Adicionar orçamento';
      default: return 'Cadastro';
    }
  };

  const dataFormCardClass = 'data-form-card w-full max-w-[760px] bg-zinc-900 border border-zinc-700 rounded-2xl p-4 md:p-5 shadow-2xl';

  const dataFormFloatingCardClass = (form: DataFormKey) => (
    openDataForm === form
      ? `${dataFormCardClass} fixed left-1/2 top-24 z-50 max-h-[calc(100vh-7rem)] -translate-x-1/2 overflow-y-auto`
      : 'hidden'
  );

  const resetFormState = (form: DataFormKey) => {
    switch (form) {
      case 'property':
        setEditingProperty(null);
        setNewProperty(emptyPropertyForm);
        break;
      case 'expense':
        setEditingExpense(null);
        setNewExpense({
          propertyId: '',
          category: '',
          item: '',
          amount: '',
          purchaseDate: format(new Date(), 'yyyy-MM-dd'),
          invoiceNumber: '',
          invoiceDate: '',
          description: '',
        });
        break;
      case 'sale':
        setEditingSale(null);
        setNewSale({
          propertyId: '',
          saleDate: format(new Date(), 'yyyy-MM-dd'),
          salePrice: '',
          buyerName: '',
          commission: '',
          notes: '',
        });
        break;
      case 'supplier':
        setEditingSupplier(null);
        setNewSupplier(emptySupplierForm);
        break;
      case 'payable':
        setEditingPayable(null);
        setNewPayable(emptyPayableForm);
        break;
      case 'invoice':
        setEditingInvoice(null);
        setNewInvoice(emptyInvoiceForm);
        break;
      case 'employee':
        setEditingEmployee(null);
        setNewEmployee(emptyEmployeeForm);
        break;
      case 'receivable':
        setEditingReceivable(null);
        setNewReceivable(emptyReceivableForm);
        break;
      case 'budget':
        setEditingBudget(null);
        setNewBudget(emptyBudgetForm);
        setBudgetPropertyInput('');
        break;
    }
  };

  const openCreateForm = (form: DataFormKey) => {
    resetFormState(form);
    setOpenDataForm(form);
  };

  const closeDataForm = () => {
    if (openDataForm) resetFormState(openDataForm);
    setOpenDataForm(null);
  };

  const canAccess = useCallback((permission: PermissionKey) => {
    return Boolean(currentUser?.permissions[permission]);
  }, [currentUser]);

  const canAccessUsersArea = useCallback(() => {
    return Boolean(currentUser);
  }, [currentUser]);

  useEffect(() => {
    window.localStorage.setItem('danix-app-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    window.localStorage.setItem('danix-dashboard-widgets', JSON.stringify(dashboardWidgets));
  }, [dashboardWidgets]);

  const toggleDashboardWidget = (widget: DashboardWidgetKey) => {
    setDashboardWidgets(previous => ({ ...previous, [widget]: !previous[widget] }));
  };

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error('auth-status');
      const status = await res.json();
      setHasUsers(status.hasUsers);
      setCurrentUser(status.user || null);
      setPermissionLabels(status.permissionLabels || {});
      setAuthMode(status.hasUsers ? 'login' : 'setup');
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!currentUser?.permissions.users && !currentUser?.permissions.recoverUsers) return;
    const res = await fetch('/api/users');
    if (res.ok) {
      setAppUsers(await res.json());
    }
  }, [currentUser]);

  // Load data
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [propsRes, expRes, salesRes, suppliersRes, payablesRes, invoicesRes, employeesRes, receivablesRes, budgetsRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/expenses'),
        fetch('/api/sales'),
        fetch('/api/suppliers'),
        fetch('/api/payables'),
        fetch('/api/invoices'),
        fetch('/api/employees'),
        fetch('/api/receivables'),
        fetch('/api/budgets')
      ]);
      
      if (propsRes.ok) setProperties(await propsRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (salesRes.ok) setSales(await salesRes.json());
      if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
      if (payablesRes.ok) setPayables(await payablesRes.json());
      if (invoicesRes.ok) setInvoices(await invoicesRes.json());
      if (employeesRes.ok) setEmployees(await employeesRes.json());
      if (receivablesRes.ok) setReceivables(await receivablesRes.json());
      if (budgetsRes.ok) setBudgets(await budgetsRes.json());
      void loadUsers();
    } catch (error) {
      toast.error('Erro ao carregar dados');
    }
  }, [currentUser, loadUsers]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshAuth();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshAuth]);

  useEffect(() => {
    if (!currentUser || locked) return;
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentUser, loadData, locked]);

  useEffect(() => {
    if (!currentUser) return;
    const permission = activeTab === 'users' ? 'users' : activeTab;
    if (activeTab === 'users' ? canAccessUsersArea() : canAccess(permission as PermissionKey)) return;

    const fallback = PERMISSION_ORDER.find(key => key !== 'export' && key !== 'viewAllData' && key !== 'recoverUsers' && currentUser.permissions[key]);
    if (fallback) {
      const timeoutId = window.setTimeout(() => setActiveTab(fallback as typeof activeTab), 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (currentUser.permissions.recoverUsers) {
      const timeoutId = window.setTimeout(() => setActiveTab('users'), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeTab, canAccess, canAccessUsersArea, currentUser]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = expenseSearch.trim().toLowerCase();
    return expenses.filter(exp => {
      const expDate = parseLocalDate(exp.purchaseDate);
      const fromDate = parseLocalDate(dateRange.from);
      const toDate = parseLocalDate(dateRange.to);
      const matchesDate = expDate >= fromDate && expDate <= toDate;
      const matchesProperty = !selectedProperty || exp.propertyId === selectedProperty;
      const matchesQuickFilter =
        expenseQuickFilter === 'all' ||
        (expenseQuickFilter === 'linked' && Boolean(exp.propertyId)) ||
        (expenseQuickFilter === 'unlinked' && !exp.propertyId) ||
        (expenseQuickFilter === 'invoice' && Boolean(exp.invoiceNumber || exp.invoiceDate));
      const property = properties.find(item => item.id === exp.propertyId);
      const searchableText = [
        exp.item,
        exp.category,
        exp.invoiceNumber,
        exp.description,
        property?.name,
        property?.address,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesDate && matchesProperty && matchesQuickFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [dateRange, expenseQuickFilter, expenseSearch, expenses, properties, selectedProperty]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = saleSearch.trim().toLowerCase();
    return sales.filter(sale => {
      const saleDate = parseLocalDate(sale.saleDate);
      const fromDate = parseLocalDate(dateRange.from);
      const toDate = parseLocalDate(dateRange.to);
      const matchesDate = saleDate >= fromDate && saleDate <= toDate;
      const matchesProperty = !selectedProperty || sale.propertyId === selectedProperty;
      const matchesQuickFilter =
        saleQuickFilter === 'all' ||
        (saleQuickFilter === 'linked' && Boolean(sale.propertyId)) ||
        (saleQuickFilter === 'unlinked' && !sale.propertyId) ||
        (saleQuickFilter === 'buyer' && Boolean(sale.buyerName));
      const property = properties.find(item => item.id === sale.propertyId);
      const searchableText = [
        sale.buyerName,
        sale.notes,
        property?.name,
        property?.address,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesDate && matchesProperty && matchesQuickFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [dateRange, properties, saleQuickFilter, saleSearch, sales, selectedProperty]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase();
    return suppliers.filter(supplier => {
      const property = properties.find(item => item.id === supplier.propertyId);
      const matchesProperty = !selectedProperty || supplier.propertyId === selectedProperty;
      const matchesStatus = supplierStatusFilter === 'all' || supplier.status === supplierStatusFilter;
      const searchableText = [
        supplier.legalName,
        supplier.tradeName,
        supplier.cnpj,
        supplier.phone,
        supplier.email,
        supplier.category,
        supplier.status,
        supplier.observation,
        property?.name,
        property?.address,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesProperty && matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [properties, selectedProperty, supplierSearch, supplierStatusFilter, suppliers]);

  const filteredPayables = useMemo(() => {
    const normalizedSearch = accountSearch.trim().toLowerCase();

    return payables.filter(payable => {
      const matchesProperty = !selectedProperty || payable.propertyId === selectedProperty;
      const matchesStatus = payableStatusFilter === 'all' || payable.status === payableStatusFilter;
      const supplier = suppliers.find(item => item.id === payable.supplierId);
      const property = properties.find(item => item.id === payable.propertyId);
      const searchableText = [
        supplier?.legalName,
        supplier?.tradeName,
        property?.name,
        payable.supplierName,
        payable.product,
        payable.services,
        payable.invoiceNumber,
        payable.paymentMethod,
        payable.status,
        payable.observation,
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesProperty && matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [payables, suppliers, properties, accountSearch, payableStatusFilter, selectedProperty]);

  const invoiceListItems = useMemo<InvoiceListItem[]>(() => {
    const manualInvoices: InvoiceListItem[] = invoices.map(invoice => ({
      ...invoice,
      listId: `invoice-${invoice.id}`,
      source: 'manual',
      sourceLabel: 'Nota fiscal',
      sourceId: invoice.id,
      attachmentName: invoice.attachmentName,
      attachmentType: invoice.attachmentType,
      attachmentData: invoice.attachmentData,
    }));

    const expenseInvoices: InvoiceListItem[] = expenses
      .filter(expense => Boolean(expense.invoiceNumber || expense.invoiceDate))
      .map(expense => ({
        id: expense.id,
        ownerUserId: expense.ownerUserId,
        propertyId: expense.propertyId,
        supplierId: undefined,
        clientName: undefined,
        number: expense.invoiceNumber,
        issueDate: expense.invoiceDate || expense.purchaseDate,
        dueDate: undefined,
        amount: expense.amount,
        status: 'paid',
        type: 'payable',
        description: expense.item || expense.description || expense.category,
        attachmentName: expense.invoiceAttachmentName,
        attachmentType: expense.invoiceAttachmentType,
        attachmentData: expense.invoiceAttachmentData,
        listId: `expense-${expense.id}`,
        source: 'expense',
        sourceLabel: 'Despesa',
        sourceId: expense.id,
      }));

    const payableInvoices: InvoiceListItem[] = payables
      .filter(payable => Boolean(payable.invoiceNumber || payable.invoiceDate))
      .map(payable => {
        const supplier = suppliers.find(item => item.id === payable.supplierId);
        return {
          id: payable.id,
          ownerUserId: payable.ownerUserId,
          propertyId: payable.propertyId,
          supplierId: payable.supplierId,
          clientName: payable.supplierName || supplier?.tradeName || supplier?.legalName,
          number: payable.invoiceNumber,
          issueDate: payable.invoiceDate || payable.purchaseDate,
          dueDate: payable.dueDate,
          amount: payable.amount,
          status: payable.status,
          type: 'payable',
          description: payable.product || payable.services || payable.observation,
          attachmentName: payable.invoiceAttachmentName,
          attachmentType: payable.invoiceAttachmentType,
          attachmentData: payable.invoiceAttachmentData,
          listId: `payable-${payable.id}`,
          source: 'payable',
          sourceLabel: 'Conta a pagar',
          sourceId: payable.id,
        };
      });

    return [...manualInvoices, ...expenseInvoices, ...payableInvoices].sort((a, b) => {
      const dateA = a.issueDate || a.dueDate || '';
      const dateB = b.issueDate || b.dueDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [expenses, invoices, payables, suppliers]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = invoiceSearch.trim().toLowerCase();
    return invoiceListItems.filter(invoice => {
      const property = properties.find(item => item.id === invoice.propertyId);
      const supplier = suppliers.find(item => item.id === invoice.supplierId);
      const matchesProperty = !selectedProperty || invoice.propertyId === selectedProperty;
      const matchesStatus = invoiceStatusFilter === 'all' || invoice.status === invoiceStatusFilter;
      const searchableText = [
        invoice.clientName,
        invoice.number,
        invoice.description,
        invoice.status,
        invoice.type,
        invoice.sourceLabel,
        property?.name,
        supplier?.legalName,
        supplier?.tradeName,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesProperty && matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [invoiceListItems, invoiceSearch, invoiceStatusFilter, properties, selectedProperty, suppliers]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase();
    return employees.filter(employee => {
      const matchesStatus = employeeStatusFilter === 'all' || employee.status === employeeStatusFilter;
      const searchableText = [
        employee.name,
        employee.role,
        employee.phone,
        employee.email,
        employee.document,
        employee.status,
        employee.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [employees, employeeSearch, employeeStatusFilter]);

  const isWithinReceivablePeriod = useCallback((date: string) => {
    if (receivablePeriod === 'all') return true;
    const target = parseLocalDate(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (receivablePeriod === 'day') {
      return target.toDateString() === today.toDateString();
    }
    if (receivablePeriod === 'week') {
      const day = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return target >= start && target <= end;
    }
    if (receivablePeriod === 'month') {
      return target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
    }
    return target.getFullYear() === today.getFullYear();
  }, [receivablePeriod]);

  const filteredReceivables = useMemo(() => {
    const normalizedSearch = receivableSearch.trim().toLowerCase();
    return receivables.filter(receivable => {
      const property = properties.find(item => item.id === receivable.propertyId);
      const matchesProperty = !selectedProperty || receivable.propertyId === selectedProperty;
      const searchableText = [
        receivable.clientName,
        receivable.description,
        receivable.status,
        receivable.paymentMethod,
        receivable.observation,
        property?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesProperty && isWithinReceivablePeriod(receivable.dueDate) && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [isWithinReceivablePeriod, properties, receivableSearch, receivables, selectedProperty]);

  const filteredBudgets = useMemo(() => {
    const normalizedSearch = budgetSearch.trim().toLowerCase();
    return budgets.filter(budget => {
      const property = properties.find(item => item.id === budget.propertyId);
      const matchesProperty = !selectedProperty || budget.propertyId === selectedProperty;
      const matchesStatus = budgetStatusFilter === 'all' || budget.status === budgetStatusFilter;
      const searchableText = [
        budget.clientName,
        budget.title,
        budget.description,
        budget.status,
        budget.observation,
        property?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesProperty && matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [budgetSearch, budgetStatusFilter, budgets, properties, selectedProperty]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
  }, [filteredExpenses]);

  const totalPayables = useMemo(() => {
    return filteredPayables.reduce((sum, payable) => sum + parseFloat(payable.amount || '0'), 0);
  }, [filteredPayables]);

  const openPayables = useMemo(() => {
    return filteredPayables
      .filter(payable => payable.status === 'open' || payable.status === 'overdue')
      .reduce((sum, payable) => sum + parseFloat(payable.amount || '0'), 0);
  }, [filteredPayables]);

  const pendingPayables = useMemo(() => {
    return filteredPayables
      .filter(payable => payable.status === 'open')
      .reduce((sum, payable) => sum + parseFloat(payable.amount || '0'), 0);
  }, [filteredPayables]);

  const overduePayables = useMemo(() => {
    return filteredPayables
      .filter(payable => payable.status === 'overdue')
      .reduce((sum, payable) => sum + parseFloat(payable.amount || '0'), 0);
  }, [filteredPayables]);

  const upcomingDuePayables = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return filteredPayables
      .filter(payable => payable.status === 'open')
      .filter(payable => {
        const dueDate = parseLocalDate(payable.dueDate);
        return dueDate >= start && dueDate <= end;
      })
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [filteredPayables]);

  const upcomingDueTotal = useMemo(() => {
    return upcomingDuePayables.reduce((sum, payable) => sum + parseFloat(payable.amount || '0'), 0);
  }, [upcomingDuePayables]);

  const totalSales = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.salePrice || '0'), 0);
  }, [filteredSales]);

  const totalCommission = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.commission || '0'), 0);
  }, [filteredSales]);

  const totalCosts = totalExpenses + totalPayables;
  const netProfit = totalSales - totalCosts - totalCommission;
  const toMoneyNumber = (value: number | string | undefined | null) => {
    const numberValue = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  const filteredCostEntries = useMemo(() => {
    return buildUnifiedCostEntries(filteredExpenses, filteredPayables, suppliers);
  }, [filteredExpenses, filteredPayables, suppliers]);

  const totalFilteredCosts = useMemo(() => {
    return filteredCostEntries.reduce((sum, entry) => sum + entry.amount, 0);
  }, [filteredCostEntries]);

  const expensesByCategory = useMemo(() => {
    const grouped = filteredCostEntries.reduce((acc, entry) => {
      const category = entry.category || entry.source || 'Sem categoria';
      acc[category] = (acc[category] || 0) + entry.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredCostEntries]);

  const payableStatusChartData = useMemo(() => {
    const statusItems = [
      { name: 'Em aberto', value: filteredPayables.filter(item => item.status === 'open').reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0), color: '#fbbf24' },
      { name: 'Pago', value: filteredPayables.filter(item => item.status === 'paid').reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0), color: '#6ee7b7' },
      { name: 'Atrasado', value: filteredPayables.filter(item => item.status === 'overdue').reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0), color: '#fda4af' },
    ];
    return statusItems.filter(item => item.value > 0);
  }, [filteredPayables]);

  const monthlyCostChartData = useMemo(() => {
    const grouped = filteredCostEntries.reduce((acc, item) => {
      const parsedDate = parseLocalDate(item.date);
      const key = format(parsedDate, 'MM/yy');
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([month, value]) => ({ month, value })).slice(-8);
  }, [filteredCostEntries]);

  const propertyStats = useMemo(() => {
    return properties.map(prop => {
      const purchasePrice = toMoneyNumber(prop.purchasePrice);
      const currentValue = toMoneyNumber(prop.currentValue);
      const propExpenses = expenses
        .filter(e => e.propertyId === prop.id)
        .reduce((sum, e) => sum + toMoneyNumber(e.amount), 0);

      const propPayables = payables
        .filter(payable => payable.propertyId === prop.id)
        .reduce((sum, payable) => sum + toMoneyNumber(payable.amount), 0);

      const propOpenPayables = payables
        .filter(payable => payable.propertyId === prop.id && payable.status === 'open')
        .reduce((sum, payable) => sum + toMoneyNumber(payable.amount), 0);

      const propOverduePayables = payables
        .filter(payable => payable.propertyId === prop.id && payable.status === 'overdue')
        .reduce((sum, payable) => sum + toMoneyNumber(payable.amount), 0);

      const propPaidPayables = payables
        .filter(payable => payable.propertyId === prop.id && payable.status === 'paid')
        .reduce((sum, payable) => sum + toMoneyNumber(payable.amount), 0);
      
      const propSales = sales
        .filter(s => s.propertyId === prop.id)
        .reduce((sum, s) => sum + toMoneyNumber(s.salePrice), 0);
      
      const referenceValue = propSales > 0 ? propSales : currentValue;
      const investedTotal = purchasePrice + propExpenses + propPayables;
      const profit = referenceValue > 0 ? referenceValue - investedTotal : 0;
      
      return {
        ...prop,
        purchasePriceValue: purchasePrice,
        currentValueValue: currentValue,
        referenceValue,
        totalSpent: investedTotal,
        directExpenses: propExpenses,
        payableExpenses: propPayables,
        openPayablesValue: propOpenPayables,
        overduePayablesValue: propOverduePayables,
        paidPayablesValue: propPaidPayables,
        additionalExpenses: propExpenses + propPayables,
        totalSales: propSales,
        profit,
        roi: investedTotal > 0 && referenceValue > 0 ? (profit / investedTotal) * 100 : 0
      };
    });
  }, [properties, expenses, payables, sales]);

  const filteredPropertyStats = useMemo(() => {
    const normalizedSearch = propertySearch.trim().toLowerCase();
    return propertyStats.filter(property => {
      const matchesStatus = propertyStatusFilter === 'all' || property.status === propertyStatusFilter;
      const searchableText = [
        property.name,
        property.address,
        property.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [propertySearch, propertyStatusFilter, propertyStats]);

  const filteredCostAnalysis = useMemo(() => {
    return buildUnifiedCostAnalysis(filteredCostEntries);
  }, [filteredCostEntries]);

  const propertyDetail = useMemo(() => {
    if (!propertyDetailId) return null;
    return propertyStats.find(property => property.id === propertyDetailId) ?? null;
  }, [propertyDetailId, propertyStats]);

  const propertyDetailExpenses = useMemo(() => {
    if (!propertyDetailId) return [];
    return expenses.filter(expense => expense.propertyId === propertyDetailId);
  }, [expenses, propertyDetailId]);

  const propertyDetailSales = useMemo(() => {
    if (!propertyDetailId) return [];
    return sales.filter(sale => sale.propertyId === propertyDetailId);
  }, [sales, propertyDetailId]);

  const propertyDetailSuppliers = useMemo(() => {
    if (!propertyDetailId) return [];
    return suppliers.filter(supplier => supplier.propertyId === propertyDetailId);
  }, [propertyDetailId, suppliers]);

  const propertyDetailPayables = useMemo(() => {
    if (!propertyDetailId) return [];
    return payables.filter(payable => payable.propertyId === propertyDetailId);
  }, [payables, propertyDetailId]);

  const propertyDetailCostAnalysis = useMemo(() => {
    if (!propertyDetailId) return [];
    return buildUnifiedCostAnalysis(buildUnifiedCostEntries(propertyDetailExpenses, propertyDetailPayables, suppliers));
  }, [propertyDetailExpenses, propertyDetailId, propertyDetailPayables, suppliers]);

  const translateApiError = (message: unknown, fallback: string) => {
    const rawMessage = typeof message === 'string' ? message.trim() : '';
    if (!rawMessage) return fallback;

    const knownMessages: Record<string, string> = {
      'Setup required': 'Configure o primeiro administrador antes de continuar.',
      'Authentication required': 'Entre novamente para continuar.',
      'Permission denied': 'Voce nao tem permissao para esta acao.',
      'Username and password with at least 6 characters are required': 'Informe usuario e senha com pelo menos 6 caracteres.',
      'Too many login attempts': 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
      'Invalid username or password': 'Usuario ou senha invalidos.',
      'Password data is invalid': 'Informe a senha atual e uma nova senha com pelo menos 6 caracteres.',
      'Current password is invalid': 'Senha atual invalida.',
      'Recovery data is invalid': 'Dados de recuperacao invalidos.',
      'Property data is invalid': 'Dados do imovel invalidos.',
      'Supplier data is invalid': 'Dados do fornecedor invalidos.',
      'Payable data is invalid': 'Dados da conta a pagar invalidos.',
      'Expense data is invalid': 'Dados da despesa invalidos.',
      'Sale data is invalid': 'Dados da venda invalidos.',
      'Invoice data is invalid': 'Dados da nota fiscal invalidos.',
      'Employee data is invalid': 'Dados do funcionario invalidos.',
      'Receivable data is invalid': 'Dados da conta a receber invalidos.',
      'Budget data is invalid': 'Dados do orcamento invalidos.',
      'Property not found': 'Imovel nao encontrado.',
      'Supplier not found': 'Fornecedor nao encontrado.',
      'Payable not found': 'Conta a pagar nao encontrada.',
      'Expense not found': 'Despesa nao encontrada.',
      'Sale not found': 'Venda nao encontrada.',
      'Invoice not found': 'Nota fiscal nao encontrada.',
      'Employee not found': 'Funcionario nao encontrado.',
      'Receivable not found': 'Conta a receber nao encontrada.',
      'Budget not found': 'Orcamento nao encontrado.',
      'User not found': 'Usuario nao encontrado.',
      'ID is required': 'Identificador obrigatorio nao informado.',
      'User ID is required': 'Identificador do usuario nao informado.',
      'Cannot delete a property with linked records': 'Nao e possivel excluir um imovel com registros vinculados.',
      'Cannot delete a supplier with linked records': 'Nao e possivel excluir um fornecedor com registros vinculados.',
      'At least one active administrator is required': 'E necessario manter pelo menos um administrador ativo.',
    };

    if (knownMessages[rawMessage]) return knownMessages[rawMessage];
    if (/^Failed to/i.test(rawMessage)) return fallback;
    if (rawMessage.toLowerCase().includes('sql') || rawMessage.toLowerCase().includes('sqlite')) return fallback;
    return rawMessage;
  };

  const getErrorMessage = async (res: Response, fallback: string) => {
    try {
      const data = await res.json();
      return translateApiError(data.error, fallback);
    } catch {
      return fallback;
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProperty.name || !newProperty.address || !newProperty.purchaseDate) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        ...newProperty,
        purchasePrice: newProperty.purchasePrice || '0',
      };
      const res = await fetch('/api/properties', {
        method: editingProperty ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProperty ? { ...payload, id: editingProperty.id } : payload),
      });
      
      if (res.ok) {
        toast.success(editingProperty ? 'Imóvel atualizado com sucesso!' : 'Imóvel adicionado com sucesso!');
        setNewProperty(emptyPropertyForm);
        setEditingProperty(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar imóvel'));
      }
    } catch (error) {
      toast.error('Erro ao salvar imóvel');
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.legalName) {
      toast.error('Preencha a razao social');
      return;
    }

    try {
      const res = await fetch('/api/suppliers', {
        method: editingSupplier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSupplier ? { ...newSupplier, id: editingSupplier.id } : newSupplier),
      });

      if (res.ok) {
        toast.success(editingSupplier ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
        setNewSupplier(emptySupplierForm);
        setEditingSupplier(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar fornecedor'));
      }
    } catch (error) {
      toast.error('Erro ao salvar fornecedor');
    }
  };

  const handleAddPayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPayable.product && !newPayable.services) || !newPayable.amount || !newPayable.purchaseDate || !newPayable.dueDate) {
      toast.error('Informe produto ou serviço, valor, compra e vencimento');
      return;
    }

    const installmentTotal = Math.max(1, parseInt(newPayable.installmentTotal || '1', 10) || 1);
    const installmentDates = newPayable.installmentDates
      .split(/[\n,;]+/)
      .map(date => date.trim())
      .filter(Boolean);
    const totalAmount = parseFloat(newPayable.amount);
    const baseAmount = Math.floor((totalAmount / installmentTotal) * 100) / 100;

    const payload = {
      ...newPayable,
      propertyId: newPayable.propertyId ? parseInt(newPayable.propertyId) : null,
      supplierId: newPayable.supplierId ? parseInt(newPayable.supplierId) : null,
      supplierName: newPayable.supplierName.trim(),
      amount: totalAmount,
      term: calculateTermFromToday(newPayable.dueDate),
      installmentNumber: newPayable.installmentNumber ? parseInt(newPayable.installmentNumber, 10) : null,
      installmentTotal,
    };

    try {
      if (!editingPayable && installmentTotal > 1) {
        const responses = await Promise.all(Array.from({ length: installmentTotal }, (_, index) => {
          const dueDate = installmentDates[index] && isValidDateInput(installmentDates[index])
            ? installmentDates[index]
            : addMonthsToDateInput(newPayable.dueDate, index);
          const amount = index === installmentTotal - 1
            ? Number((totalAmount - baseAmount * (installmentTotal - 1)).toFixed(2))
            : baseAmount;

          return fetch('/api/payables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              dueDate,
              amount,
              term: calculateTermFromToday(dueDate),
              installmentNumber: index + 1,
              installmentTotal,
            }),
          });
        }));

        const failed = responses.find(response => !response.ok);
        if (failed) {
          toast.error(await getErrorMessage(failed, 'Erro ao salvar parcelas'));
          return;
        }

        toast.success('Parcelas registradas!');
        setNewPayable(emptyPayableForm);
        setEditingPayable(null);
        setOpenDataForm(null);
        void loadData();
        return;
      }

      const res = await fetch('/api/payables', {
        method: editingPayable ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPayable ? { ...payload, id: editingPayable.id } : payload),
      });

      if (res.ok) {
        toast.success(editingPayable ? 'Conta atualizada!' : 'Conta registrada!');
        setNewPayable(emptyPayableForm);
        setEditingPayable(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar conta'));
      }
    } catch (error) {
      toast.error('Erro ao salvar conta');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.item || !newExpense.amount) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const payload = {
      ...newExpense,
      propertyId: newExpense.propertyId ? parseInt(newExpense.propertyId) : null,
      amount: parseFloat(newExpense.amount),
    };

    try {
      const res = await fetch('/api/expenses', {
        method: editingExpense ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingExpense ? { ...payload, id: editingExpense.id } : payload),
      });
      
      if (res.ok) {
        toast.success(editingExpense ? 'Despesa atualizada!' : 'Despesa adicionada!');
        setNewExpense({
          propertyId: '',
          category: '',
          item: '',
          amount: '',
          purchaseDate: format(new Date(), 'yyyy-MM-dd'),
          invoiceNumber: '',
          invoiceDate: '',
          description: ''
        });
        setEditingExpense(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar despesa'));
      }
    } catch (error) {
      toast.error('Erro ao salvar despesa');
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.salePrice) {
      toast.error('Preencha o valor da venda');
      return;
    }

    const payload = {
      ...newSale,
      propertyId: newSale.propertyId ? parseInt(newSale.propertyId) : null,
      salePrice: parseFloat(newSale.salePrice),
      commission: newSale.commission ? parseFloat(newSale.commission) : 0,
    };

    try {
      const res = await fetch('/api/sales', {
        method: editingSale ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSale ? { ...payload, id: editingSale.id } : payload),
      });
      
      if (res.ok) {
        toast.success(editingSale ? 'Venda atualizada!' : 'Venda registrada com sucesso!');
        setNewSale({
          propertyId: '',
          saleDate: format(new Date(), 'yyyy-MM-dd'),
          salePrice: '',
          buyerName: '',
          commission: '',
          notes: ''
        });
        setEditingSale(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao registrar venda'));
      }
    } catch (error) {
      toast.error('Erro ao registrar venda');
    }
  };

  const deleteExpense = async (id: number) => {
    if (!(await requestConfirmation('Tem certeza que deseja excluir esta despesa?'))) return;
    
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Despesa excluída');
        if (editingExpense?.id === id) {
          setEditingExpense(null);
          setNewExpense({
            propertyId: '',
            category: '',
            item: '',
            amount: '',
            purchaseDate: format(new Date(), 'yyyy-MM-dd'),
            invoiceNumber: '',
            invoiceDate: '',
            description: '',
          });
        }
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir despesa'));
      }
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const deleteSale = async (id: number) => {
    if (!(await requestConfirmation('Tem certeza que deseja excluir esta venda?'))) return;
    
    try {
      const res = await fetch(`/api/sales?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Venda excluída');
        if (editingSale?.id === id) {
          setEditingSale(null);
          setNewSale({
            propertyId: '',
            saleDate: format(new Date(), 'yyyy-MM-dd'),
            salePrice: '',
            buyerName: '',
            commission: '',
            notes: '',
          });
        }
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir venda'));
      }
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const editProperty = (property: Property) => {
    setEditingProperty(property);
    setNewProperty({
      name: property.name,
      address: property.address,
      purchaseDate: property.purchaseDate.split('T')[0],
      purchasePrice: property.purchasePrice,
      currentValue: property.currentValue || '',
      status: property.status,
    });
    setActiveTab('properties');
    setOpenDataForm('property');
  };

  const deleteProperty = async (id: number) => {
    if (!(await requestConfirmation('Tem certeza que deseja excluir este imovel?'))) return;

    try {
      const res = await fetch(`/api/properties?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Imóvel excluído');
        if (selectedProperty === id) setSelectedProperty(null);
        if (propertyDetailId === id) setPropertyDetailId(null);
        if (editingProperty?.id === id) {
          setEditingProperty(null);
          setNewProperty(emptyPropertyForm);
        }
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir imóvel'));
      }
    } catch (error) {
      toast.error('Erro ao excluir imóvel');
    }
  };

  const editSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({
      propertyId: supplier.propertyId?.toString() || '',
      legalName: supplier.legalName,
      tradeName: supplier.tradeName || '',
      cnpj: supplier.cnpj || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      category: supplier.category,
      status: supplier.status,
      observation: supplier.observation || '',
    });
    setActiveTab('suppliers');
    setOpenDataForm('supplier');
  };

  const deleteSupplier = async (id: number) => {
    if (!(await requestConfirmation('Tem certeza que deseja excluir este fornecedor?'))) return;

    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Fornecedor excluído');
        if (editingSupplier?.id === id) {
          setEditingSupplier(null);
          setNewSupplier(emptySupplierForm);
        }
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir fornecedor'));
      }
    } catch (error) {
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const editPayable = (payable: Payable) => {
    const supplier = suppliers.find(item => item.id === payable.supplierId);
    setEditingPayable(payable);
    setNewPayable({
      propertyId: payable.propertyId?.toString() || '',
      supplierId: payable.supplierId?.toString() || '',
      supplierName: supplier?.tradeName || supplier?.legalName || payable.supplierName || '',
      product: payable.product || '',
      services: payable.services || '',
      purchaseDate: payable.purchaseDate.split('T')[0],
      amount: payable.amount,
      invoiceDate: payable.invoiceDate ? payable.invoiceDate.split('T')[0] : '',
      invoiceNumber: payable.invoiceNumber || '',
      term: payable.term || '',
      paymentMethod: payable.paymentMethod || PAYMENT_METHODS[0],
      dueDate: payable.dueDate.split('T')[0],
      status: payable.status,
      observation: payable.observation || '',
      installmentNumber: payable.installmentNumber?.toString() || '',
      installmentTotal: payable.installmentTotal?.toString() || '1',
      installmentDates: '',
    });
    setActiveTab('payables');
    setOpenDataForm('payable');
  };

  const deletePayable = async (id: number) => {
    if (!(await requestConfirmation('Tem certeza que deseja excluir esta conta?'))) return;

    try {
      const res = await fetch(`/api/payables?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Conta excluída');
        if (editingPayable?.id === id) {
          setEditingPayable(null);
          setNewPayable(emptyPayableForm);
        }
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir conta'));
      }
    } catch (error) {
      toast.error('Erro ao excluir conta');
    }
  };

  const markPayablePaid = async (payable: Payable) => {
    try {
      const nextStatus = payable.status === 'paid' ? 'open' : 'paid';
      const res = await fetch('/api/payables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payable,
          id: payable.id,
          propertyId: payable.propertyId ?? null,
          supplierId: payable.supplierId ?? null,
          supplierName: payable.supplierName || '',
          amount: parseFloat(payable.amount || '0'),
          status: nextStatus,
          term: calculateTermFromToday(payable.dueDate),
          installmentNumber: payable.installmentNumber ?? null,
          installmentTotal: payable.installmentTotal ?? null,
        }),
      });

      if (res.ok) {
        toast.success(nextStatus === 'paid' ? 'Conta marcada como paga' : 'Conta desmarcada como paga');
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao atualizar status da conta'));
      }
    } catch (error) {
      toast.error('Erro ao atualizar status da conta');
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newInvoice,
      propertyId: newInvoice.propertyId ? parseInt(newInvoice.propertyId) : null,
      supplierId: newInvoice.supplierId ? parseInt(newInvoice.supplierId) : null,
      amount: newInvoice.amount ? parseFloat(newInvoice.amount) : 0,
    };

    try {
      const res = await fetch('/api/invoices', {
        method: editingInvoice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingInvoice ? { ...payload, id: editingInvoice.id } : payload),
      });
      if (res.ok) {
        toast.success(editingInvoice ? 'Nota fiscal atualizada!' : 'Nota fiscal cadastrada!');
        setNewInvoice(emptyInvoiceForm);
        setEditingInvoice(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar nota fiscal'));
      }
    } catch (error) {
      toast.error('Erro ao salvar nota fiscal');
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name) {
      toast.error('Informe o nome do funcionario');
      return;
    }

    try {
      const res = await fetch('/api/employees', {
        method: editingEmployee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEmployee ? { ...newEmployee, id: editingEmployee.id } : newEmployee),
      });
      if (res.ok) {
        toast.success(editingEmployee ? 'Funcionario atualizado!' : 'Funcionario cadastrado!');
        setNewEmployee(emptyEmployeeForm);
        setEditingEmployee(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar funcionario'));
      }
    } catch (error) {
      toast.error('Erro ao salvar funcionario');
    }
  };

  const handleSaveReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceivable.description || !newReceivable.amount || !newReceivable.dueDate) {
      toast.error('Informe descricao, valor e vencimento');
      return;
    }
    const payload = {
      ...newReceivable,
      propertyId: newReceivable.propertyId ? parseInt(newReceivable.propertyId) : null,
      amount: parseFloat(newReceivable.amount),
    };

    try {
      const res = await fetch('/api/receivables', {
        method: editingReceivable ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingReceivable ? { ...payload, id: editingReceivable.id } : payload),
      });
      if (res.ok) {
        toast.success(editingReceivable ? 'Conta a receber atualizada!' : 'Conta a receber cadastrada!');
        setNewReceivable(emptyReceivableForm);
        setEditingReceivable(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar conta a receber'));
      }
    } catch (error) {
      toast.error('Erro ao salvar conta a receber');
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudget.title || !newBudget.amount) {
      toast.error('Informe titulo e valor');
      return;
    }
    const payload = {
      ...newBudget,
      propertyId: newBudget.propertyId ? parseInt(newBudget.propertyId) : null,
      amount: parseFloat(newBudget.amount),
    };

    try {
      const res = await fetch('/api/budgets', {
        method: editingBudget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBudget ? { ...payload, id: editingBudget.id } : payload),
      });
      if (res.ok) {
        toast.success(editingBudget ? 'Orcamento atualizado!' : 'Orcamento cadastrado!');
        setNewBudget(emptyBudgetForm);
        setBudgetPropertyInput('');
        setEditingBudget(null);
        setOpenDataForm(null);
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao salvar orcamento'));
      }
    } catch (error) {
      toast.error('Erro ao salvar orcamento');
    }
  };

  const deleteRecord = async (apiPath: string, id: number, label: string, afterDelete: () => void) => {
    if (!(await requestConfirmation(`Tem certeza que deseja excluir ${label}?`))) return;

    try {
      const res = await fetch(`${apiPath}?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Registro excluido');
        afterDelete();
        releaseActiveElement();
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao excluir registro'));
      }
    } catch (error) {
      toast.error('Erro ao excluir registro');
    }
  };

  const allowedInvoiceAttachmentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

  const selectInvoiceAttachment = (invoice: InvoiceListItem) => {
    setPendingInvoiceAttachment(invoice);
    if (invoiceAttachmentInputRef.current) {
      invoiceAttachmentInputRef.current.value = '';
      invoiceAttachmentInputRef.current.click();
    }
  };

  const updateInvoiceAttachment = async (invoice: InvoiceListItem, file: File, attachmentData: string) => {
    if (invoice.source === 'expense') {
      const expense = expenses.find(item => item.id === invoice.sourceId);
      if (!expense) throw new Error('expense_not_found');
      return fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expense,
          id: expense.id,
          propertyId: expense.propertyId ?? null,
          amount: parseFloat(expense.amount),
          invoiceAttachmentName: file.name,
          invoiceAttachmentType: file.type,
          invoiceAttachmentData: attachmentData,
        }),
      });
    }

    if (invoice.source === 'payable') {
      const payable = payables.find(item => item.id === invoice.sourceId);
      if (!payable) throw new Error('payable_not_found');
      return fetch('/api/payables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payable,
          id: payable.id,
          propertyId: payable.propertyId ?? null,
          supplierId: payable.supplierId ?? null,
          amount: parseFloat(payable.amount),
          invoiceAttachmentName: file.name,
          invoiceAttachmentType: file.type,
          invoiceAttachmentData: attachmentData,
        }),
      });
    }

    return fetch('/api/invoices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...invoice,
        id: invoice.id,
        propertyId: invoice.propertyId ?? null,
        supplierId: invoice.supplierId ?? null,
        amount: invoice.amount ? parseFloat(invoice.amount) : 0,
        attachmentName: file.name,
        attachmentType: file.type,
        attachmentData,
      }),
    });
  };

  const handleInvoiceAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = pendingInvoiceAttachment;
    event.target.value = '';
    setPendingInvoiceAttachment(null);

    if (!file || !target) return;
    if (!allowedInvoiceAttachmentTypes.has(file.type)) {
      toast.error('Anexe apenas PDF, JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error('O anexo deve ter no maximo 6 MB.');
      return;
    }

    try {
      const attachmentData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });

      const res = await updateInvoiceAttachment(target, file, attachmentData);
      if (!res.ok) {
        toast.error(await getErrorMessage(res, 'Nao foi possivel anexar a nota fiscal'));
        return;
      }

      toast.success('Nota fiscal anexada');
      void loadData();
    } catch {
      toast.error('Nao foi possivel anexar a nota fiscal');
    }
  };

  const viewInvoiceAttachment = (invoice: InvoiceListItem) => {
    if (!invoice.attachmentData) return;
    const view = window.open();
    if (!view) {
      toast.error('Nao foi possivel abrir a visualizacao.');
      return;
    }
    view.document.write(`<iframe src="${invoice.attachmentData}" title="Nota fiscal" style="border:0;width:100vw;height:100vh"></iframe>`);
    view.document.close();
  };

  const downloadInvoiceAttachment = (invoice: InvoiceListItem) => {
    if (!invoice.attachmentData) return;
    const link = document.createElement('a');
    link.href = invoice.attachmentData;
    link.download = invoice.attachmentName || `nota-fiscal-${invoice.source}-${invoice.sourceId}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setNewInvoice({
      propertyId: invoice.propertyId?.toString() || '',
      supplierId: invoice.supplierId?.toString() || '',
      clientName: invoice.clientName || '',
      number: invoice.number || '',
      issueDate: invoice.issueDate ? invoice.issueDate.split('T')[0] : '',
      dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
      amount: invoice.amount || '',
      status: invoice.status,
      type: invoice.type,
      description: invoice.description || '',
    });
    setActiveTab('invoices');
    setOpenDataForm('invoice');
  };

  const editEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setNewEmployee({
      name: employee.name,
      role: employee.role || '',
      phone: employee.phone || '',
      email: employee.email || '',
      document: employee.document || '',
      status: employee.status,
      notes: employee.notes || '',
    });
    setActiveTab('employees');
    setOpenDataForm('employee');
  };

  const editReceivable = (receivable: Receivable) => {
    setEditingReceivable(receivable);
    setNewReceivable({
      propertyId: receivable.propertyId?.toString() || '',
      clientName: receivable.clientName || '',
      description: receivable.description,
      amount: receivable.amount,
      issueDate: receivable.issueDate ? receivable.issueDate.split('T')[0] : '',
      dueDate: receivable.dueDate.split('T')[0],
      receivedDate: receivable.receivedDate ? receivable.receivedDate.split('T')[0] : '',
      status: receivable.status,
      paymentMethod: receivable.paymentMethod || PAYMENT_METHODS[0],
      observation: receivable.observation || '',
    });
    setActiveTab('receivables');
    setOpenDataForm('receivable');
  };

  const markReceivableReceived = async (receivable: Receivable) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const nextStatus = receivable.status === 'received' ? 'open' : 'received';
      const res = await fetch('/api/receivables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...receivable,
          id: receivable.id,
          propertyId: receivable.propertyId ?? null,
          amount: parseFloat(receivable.amount || '0'),
          issueDate: receivable.issueDate || '',
          receivedDate: nextStatus === 'received' ? receivable.receivedDate || today : '',
          status: nextStatus,
          paymentMethod: receivable.paymentMethod || '',
          observation: receivable.observation || '',
        }),
      });

      if (res.ok) {
        toast.success(nextStatus === 'received' ? 'Recebimento confirmado' : 'Recebimento desmarcado');
        void loadData();
      } else {
        toast.error(await getErrorMessage(res, 'Erro ao atualizar recebimento'));
      }
    } catch {
      toast.error('Erro ao atualizar recebimento');
    }
  };

  const editBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetPropertyInput(properties.find(property => property.id === budget.propertyId)?.name || '');
    setNewBudget({
      propertyId: budget.propertyId?.toString() || '',
      clientName: budget.clientName || '',
      title: budget.title,
      description: budget.description || '',
      amount: budget.amount,
      validUntil: budget.validUntil ? budget.validUntil.split('T')[0] : '',
      status: budget.status,
      observation: budget.observation || '',
    });
    setActiveTab('budgets');
    setOpenDataForm('budget');
  };

  const editExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setNewExpense({
      propertyId: expense.propertyId?.toString() || '',
      category: expense.category,
      item: expense.item,
      amount: expense.amount,
      purchaseDate: expense.purchaseDate.split('T')[0],
      invoiceNumber: expense.invoiceNumber || '',
      invoiceDate: expense.invoiceDate ? expense.invoiceDate.split('T')[0] : '',
      description: expense.description || ''
    });
    setActiveTab('expenses');
    setOpenDataForm('expense');
  };

  const editSale = (sale: Sale) => {
    setEditingSale(sale);
    setNewSale({
      propertyId: sale.propertyId?.toString() || '',
      saleDate: sale.saleDate.split('T')[0],
      salePrice: sale.salePrice,
      buyerName: sale.buyerName || '',
      commission: sale.commission || '',
      notes: sale.notes || ''
    });
    setActiveTab('sales');
    setOpenDataForm('sale');
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'owned': return 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/20';
      case 'sold': return 'bg-sky-500/12 text-sky-300 ring-1 ring-sky-400/20';
      case 'under_reform': return 'bg-amber-500/12 text-amber-300 ring-1 ring-amber-400/20';
      default: return 'bg-zinc-500/12 text-zinc-300 ring-1 ring-zinc-400/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'owned': return 'Em Carteira';
      case 'sold': return 'Vendido';
      case 'under_reform': return 'Em Reforma';
      default: return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/20';
      case 'overdue': return 'bg-rose-500/12 text-rose-300 ring-1 ring-rose-400/20';
      case 'open': return 'bg-amber-500/12 text-amber-300 ring-1 ring-amber-400/20';
      case 'canceled': return 'bg-zinc-500/12 text-zinc-300 ring-1 ring-zinc-400/20';
      default: return 'bg-zinc-500/12 text-zinc-300 ring-1 ring-zinc-400/20';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch(status) {
      case 'paid': return 'Pago';
      case 'overdue': return 'Atrasado';
      case 'open': return 'Em aberto';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  const getPayableSupplierName = (payable: Payable) => {
    const supplier = suppliers.find(item => item.id === payable.supplierId);
    return supplier?.tradeName || supplier?.legalName || payable.supplierName || 'Sem fornecedor';
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const endpoint = authMode === 'setup' ? '/api/auth/setup' : authMode === 'recover' ? '/api/auth/recover' : '/api/auth/login';
    const payload = authMode === 'recover'
      ? { username: authForm.username, recoveryCode: authForm.recoveryCode, newPassword: authForm.newPassword }
      : { username: authForm.username, displayName: authForm.displayName, password: authForm.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error(await getErrorMessage(res, 'Nao foi possivel autenticar'));
        return;
      }

      const data = await res.json();
      if (data.recoveryCode) {
        setLastRecoveryCode(data.recoveryCode);
      }

      if (authMode === 'recover') {
        toast.success('Senha redefinida. Entre com a nova senha.');
        setAuthMode('login');
        setAuthForm({ ...authForm, password: '', newPassword: '', recoveryCode: '' });
        return;
      }

      setLocked(false);
      setAuthForm({ username: '', displayName: '', password: '', newPassword: '', recoveryCode: '' });
      await refreshAuth();
      toast.success(authMode === 'setup' ? 'Administrador criado' : 'Acesso liberado');
    } catch {
      toast.error('Erro ao autenticar');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setLocked(false);
    setProperties([]);
    setExpenses([]);
    setSales([]);
    setSuppliers([]);
    setPayables([]);
    await refreshAuth();
  };

  const lockApp = () => {
    if (!currentUser) return;
    setAuthForm({ username: currentUser.username, displayName: '', password: '', newPassword: '', recoveryCode: '' });
    setAuthMode('login');
    setLocked(true);
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = editingUser ? { ...newUser, id: editingUser.id } : newUser;
    const res = await fetch('/api/users', {
      method: editingUser ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      toast.error(await getErrorMessage(res, 'Erro ao salvar usuario'));
      return;
    }

    const data = await res.json();
    if (data.recoveryCode) {
      setLastRecoveryCode(data.recoveryCode);
    }
    toast.success(editingUser ? 'Usuario atualizado' : 'Usuario criado');
    setEditingUser(null);
    setNewUser(emptyUserForm);
    await loadUsers();
  };

  const handleChangeOwnPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('A confirmacao da senha nao confere');
      return;
    }

    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });

    if (!res.ok) {
      toast.error(await getErrorMessage(res, 'Nao foi possivel alterar a senha'));
      return;
    }

    toast.success('Senha alterada. Entre novamente.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    await logout();
  };

  const editUser = (user: AppUser) => {
    setEditingUser(user);
    setNewUser({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      password: '',
      role: user.role === 'admin' ? 'admin' : 'user',
      isActive: user.isActive,
      permissions: user.permissions,
    });
  };

  const deleteUser = async (id: number) => {
    if (!(await requestConfirmation('Remover este usuario? Ele sera desativado e nao podera acessar o app.'))) return;
    const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Usuario removido');
      await loadUsers();
      return;
    }
    toast.error(await getErrorMessage(res, 'Erro ao remover usuario'));
  };

  const generateUserRecoveryCode = async (id: number) => {
    if (!(await requestConfirmation('Gerar um novo codigo de recuperacao para este usuario? O codigo anterior sera invalidado.'))) return;

    const res = await fetch('/api/users/recovery-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      toast.error(await getErrorMessage(res, 'Erro ao gerar codigo'));
      return;
    }

    const data = await res.json();
    setLastRecoveryCode(data.recoveryCode);
    toast.success('Codigo de recuperacao gerado');
  };

  const exportManualBackup = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Apenas administradores podem exportar backup completo.');
      return;
    }

    setBackupBusy(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) {
        toast.error(await getErrorMessage(res, 'Nao foi possivel exportar o backup'));
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `danix-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.db`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso');
    } catch {
      toast.error('Nao foi possivel exportar o backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const importManualBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!currentUser || currentUser.role !== 'admin') {
      toast.error('Apenas administradores podem importar backup completo.');
      return;
    }

    if (!(await requestConfirmation('Importar este backup vai substituir os dados locais atuais. Deseja continuar?'))) return;

    setBackupBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/backup', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        toast.error(await getErrorMessage(res, 'Nao foi possivel importar o backup'));
        return;
      }

      toast.success('Backup importado. Entre novamente para carregar os dados restaurados.');
      setCurrentUser(null);
      setLocked(false);
      setProperties([]);
      setExpenses([]);
      setSales([]);
      setSuppliers([]);
      setPayables([]);
      setInvoices([]);
      setEmployees([]);
      setReceivables([]);
      setBudgets([]);
      await refreshAuth();
    } catch {
      toast.error('Nao foi possivel importar o backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleExportLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']);
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem valida');
      return;
    }
    if (!allowedLogoTypes.has(file.type)) {
      toast.error('Use PNG, JPG, WebP, SVG ou ICO');
      return;
    }
    if (file.size > 1_100_000) {
      toast.error('Use uma logo com ate 1 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/auth/logo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exportLogoData: reader.result }),
        });
        if (res.ok) {
          toast.success('Logo de exportacao atualizada');
          await refreshAuth();
        } else {
          toast.error(await getErrorMessage(res, 'Erro ao salvar logo'));
        }
      } catch (error) {
        toast.error('Erro ao salvar logo');
      }
    };
    reader.readAsDataURL(file);
  };

  const exportReportToPdf = () => {
    if (!canAccess('export')) {
      toast.error('Sem permissao para exportar');
      return;
    }
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      toast.error('Permita pop-ups para gerar o PDF');
      return;
    }
    const reportHtml = buildExportReportHtml({
      properties,
      suppliers: filteredSuppliers,
      payables: filteredPayables,
      invoices: filteredInvoices,
      employees: filteredEmployees,
      receivables: filteredReceivables,
      budgets: filteredBudgets,
      costAnalysis: filteredCostAnalysis,
      getPayableSupplierName,
      getPaymentStatusLabel,
      formatCurrency,
      parseLocalDate,
      exportLogoData: currentUser?.exportLogoData,
    });
    reportWindow.document.open();
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 500);
  };

  const parseCustomPdfItems = (): CustomPdfItem[] => customPdfForm.itemsText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [description = '', quantity = '', unitValue = '', total = ''] = line.split('|').map(part => part.trim());
      return { description, quantity, unitValue, total };
    })
    .filter(item => item.description);

  const fillCustomPdfExample = () => {
    setCustomPdfForm({
      ...customPdfForm,
      documentTitle: customPdfForm.documentTitle || 'Orcamento',
      clientName: customPdfForm.clientName || 'Cliente exemplo',
      reference: customPdfForm.reference || 'Proposta de servicos e materiais',
      introduction: customPdfForm.introduction || 'Conforme solicitado, apresentamos a proposta abaixo para avaliacao e aprovacao.',
      itemsText: customPdfExampleItems,
      paymentTerms: '50% na aprovacao e 50% na entrega dos servicos.',
      notes: 'Prazo estimado conforme disponibilidade de materiais e aprovacao do escopo.',
      signerLeft: 'Contratante',
      signerRight: 'Contratada',
    });
  };

  const resetCustomPdfForm = () => {
    setCustomPdfForm(emptyCustomPdfForm);
  };

  const exportCustomPdf = () => {
    if (!canAccess('export')) {
      toast.error('Sem permissao para exportar');
      return;
    }
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      toast.error('Permita pop-ups para gerar o PDF');
      return;
    }
    const propertyId = Number(customPdfForm.propertyId);
    const propertyName = Number.isInteger(propertyId) && propertyId > 0
      ? properties.find(property => property.id === propertyId)?.name || ''
      : '';
    const customPdfHtml = buildCustomPdfHtml({
      documentTitle: customPdfForm.documentTitle,
      clientName: customPdfForm.clientName,
      reference: customPdfForm.reference,
      propertyName,
      documentDate: customPdfForm.documentDate ? format(parseLocalDate(customPdfForm.documentDate), 'dd/MM/yyyy') : '',
      validUntil: customPdfForm.validUntil ? format(parseLocalDate(customPdfForm.validUntil), 'dd/MM/yyyy') : '',
      introduction: customPdfForm.introduction,
      items: parseCustomPdfItems(),
      paymentTerms: customPdfForm.paymentTerms,
      notes: customPdfForm.notes,
      signerLeft: customPdfForm.signerLeft,
      signerRight: customPdfForm.signerRight,
      signerThird: customPdfForm.signerThird,
      exportLogoData: currentUser?.exportLogoData,
      generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
    });
    reportWindow.document.open();
    reportWindow.document.write(customPdfHtml);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 500);
    setCustomPdfOpen(false);
  };

  const exportReportToExcel = () => {
    if (!canAccess('export')) {
      toast.error('Sem permissao para exportar');
      return;
    }
    const exportOptions = {
      properties,
      suppliers: filteredSuppliers,
      payables: filteredPayables,
      invoices: filteredInvoices,
      employees: filteredEmployees,
      receivables: filteredReceivables,
      budgets: filteredBudgets,
      costAnalysis: filteredCostAnalysis,
      getPayableSupplierName,
      getPaymentStatusLabel,
      formatCurrency,
      parseLocalDate,
      exportLogoData: currentUser?.exportLogoData,
    };
    const isXlsx = excelExportFormat === 'xlsx';
    const workbookContent = isXlsx ? buildExcelWorkbookXlsx(exportOptions) : buildExcelWorkbookXml(exportOptions);
    const blob = new Blob([workbookContent], {
      type: isXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danix-Relatorio-${format(new Date(), 'yyyy-MM-dd')}.${excelExportFormat}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        Carregando Danix...
      </div>
    );
  }

  if (!currentUser || locked) {
    const title = locked ? 'Danix bloqueado' : authMode === 'setup' ? 'Criar administrador' : authMode === 'recover' ? 'Redefinir senha' : 'Entrar no Danix';
    const subtitle = locked
      ? 'Digite a senha para desbloquear o aplicativo.'
      : authMode === 'setup'
        ? 'Primeiro acesso: crie a conta administradora local.'
        : authMode === 'recover'
          ? 'Use o codigo de recuperacao salvo no primeiro acesso ou na criacao do usuario.'
          : 'Acesse com nome de usuario e senha.';

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <Image src="/danix-logo.svg" alt="Danix" width={72} height={54} className="object-contain" priority />
            <div>
              <div className="text-3xl font-semibold text-white">Danix</div>
              <div className="text-sm text-zinc-500">{subtitle}</div>
            </div>
          </div>

          {lastRecoveryCode && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Codigo de recuperacao: <span className="font-mono font-semibold">{lastRecoveryCode}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="text-xs text-zinc-400 block mb-2">USUARIO</label>
              <input
                value={authForm.username}
                onChange={event => setAuthForm({ ...authForm, username: event.target.value })}
                disabled={locked}
                className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none disabled:opacity-70"
                required
              />
            </div>
            {authMode === 'setup' && (
              <div>
                <label className="text-xs text-zinc-400 block mb-2">NOME</label>
                <input
                  value={authForm.displayName}
                  onChange={event => setAuthForm({ ...authForm, displayName: event.target.value })}
                  className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"
                />
              </div>
            )}
            {authMode === 'recover' ? (
              <>
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">CODIGO DE RECUPERACAO</label>
                  <input
                    value={authForm.recoveryCode}
                    onChange={event => setAuthForm({ ...authForm, recoveryCode: event.target.value })}
                    className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-2">NOVA SENHA</label>
                  <input
                    type="password"
                    value={authForm.newPassword}
                    onChange={event => setAuthForm({ ...authForm, newPassword: event.target.value })}
                    className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs text-zinc-400 block mb-2">SENHA</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={event => setAuthForm({ ...authForm, password: event.target.value })}
                  className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"
                  required
                />
              </div>
            )}
            <button type="submit" className="w-full bg-white text-zinc-950 py-4 font-semibold rounded-3xl hover:bg-zinc-100 transition-all">
              {title}
            </button>
          </form>

          {hasUsers && !locked && (
            <div className="mt-5 flex justify-between text-sm">
              <button type="button" onClick={() => setAuthMode(authMode === 'recover' ? 'login' : 'recover')} className="text-zinc-400 hover:text-white">
                {authMode === 'recover' ? 'Voltar ao login' : 'Esqueci a senha'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${appTheme === 'light-blue' ? 'theme-app-light-blue' : ''} min-h-screen bg-zinc-950`}>
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-7 shadow-2xl">
            <div className="text-lg font-semibold text-white">Confirmar exclusao</div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{confirmDialog.message}</p>
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirmation(false)}
                className="rounded-3xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => closeConfirmation(true)}
                className="rounded-3xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-red-400"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {(openDataForm || customPdfOpen) && (
        <button
          type="button"
          aria-label="Fechar janela"
          onClick={() => {
            closeDataForm();
            setCustomPdfOpen(false);
          }}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      {customPdfOpen && (
        <div className="data-form-card fixed left-1/2 top-24 z-50 max-h-[calc(100vh-7rem)] w-[min(820px,calc(100vw-1rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-4 md:p-5 shadow-2xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[2px] text-violet-400">PDF personalizado</div>
              <h3 className="mt-2 text-2xl font-semibold text-white">Documento editavel antes da exportacao</h3>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Preencha, revise e gere um PDF pronto para imprimir ou assinar.
              </p>
            </div>
            <button type="button" onClick={() => setCustomPdfOpen(false)} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Titulo</label>
              <input value={customPdfForm.documentTitle} onChange={event => setCustomPdfForm({ ...customPdfForm, documentTitle: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Cliente / responsavel</label>
              <input value={customPdfForm.clientName} onChange={event => setCustomPdfForm({ ...customPdfForm, clientName: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Referencia</label>
              <input value={customPdfForm.reference} onChange={event => setCustomPdfForm({ ...customPdfForm, reference: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>

            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Imovel relacionado</label>
              <select value={customPdfForm.propertyId} onChange={event => setCustomPdfForm({ ...customPdfForm, propertyId: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none">
                <option value="">Sem imovel relacionado</option>
                {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Data do documento</label>
              <input type="date" value={customPdfForm.documentDate} onChange={event => setCustomPdfForm({ ...customPdfForm, documentDate: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Validade</label>
              <input type="date" value={customPdfForm.validUntil} onChange={event => setCustomPdfForm({ ...customPdfForm, validUntil: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>

            <div className="md:col-span-12">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Introducao</label>
              <textarea value={customPdfForm.introduction} onChange={event => setCustomPdfForm({ ...customPdfForm, introduction: event.target.value })} className="h-24 w-full resize-y rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>

            <div className="md:col-span-12">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="block text-xs uppercase tracking-wide text-zinc-400">Itens, servicos ou etapas</label>
                <div className="text-xs text-zinc-500">Uma linha por item: descricao | qtd | valor unitario | total</div>
              </div>
              <textarea value={customPdfForm.itemsText} onChange={event => setCustomPdfForm({ ...customPdfForm, itemsText: event.target.value })} className="h-36 w-full resize-y rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-4 font-mono text-sm outline-none" placeholder="Descricao | 1 | R$ 0,00 | R$ 0,00" />
            </div>

            <div className="md:col-span-6">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Condicoes de pagamento</label>
              <textarea value={customPdfForm.paymentTerms} onChange={event => setCustomPdfForm({ ...customPdfForm, paymentTerms: event.target.value })} className="h-28 w-full resize-y rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-6">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Observacoes</label>
              <textarea value={customPdfForm.notes} onChange={event => setCustomPdfForm({ ...customPdfForm, notes: event.target.value })} className="h-28 w-full resize-y rounded-3xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>

            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Assinatura 1</label>
              <input value={customPdfForm.signerLeft} onChange={event => setCustomPdfForm({ ...customPdfForm, signerLeft: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Assinatura 2</label>
              <input value={customPdfForm.signerRight} onChange={event => setCustomPdfForm({ ...customPdfForm, signerRight: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">Assinatura 3 opcional</label>
              <input value={customPdfForm.signerThird} onChange={event => setCustomPdfForm({ ...customPdfForm, signerThird: event.target.value })} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-4 outline-none" />
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={fillCustomPdfExample} className="rounded-3xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
                Preencher exemplo
              </button>
              <button type="button" onClick={resetCustomPdfForm} className="rounded-3xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800">
                Limpar
              </button>
            </div>
            <button type="button" onClick={exportCustomPdf} className="rounded-3xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">
              Gerar PDF personalizado
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="app-sidebar fixed left-0 top-0 h-screen w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-8 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Image src="/danix-logo.svg" alt="Danix" width={64} height={48} className="object-contain" priority />
            <div>
              <div className="text-2xl font-semibold text-white tracking-tight">Danix</div>
              <div className="sidebar-tagline text-xs text-zinc-500 -mt-1">Gestão • Controle • Resultados</div>
            </div>
          </div>
        </div>

        <div className="p-3 flex-1">
          <div className="px-3 py-2 text-xs font-medium text-zinc-500 mb-2">PRINCIPAL</div>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`${!canAccess('dashboard') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'dashboard' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <BarChart3 className="w-5 h-5" />
            Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('properties')}
            className={`${!canAccess('properties') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'properties' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <Home className="w-5 h-5" />
            Imóveis
          </button>

          <button 
            onClick={() => setActiveTab('expenses')}
            className={`${!canAccess('expenses') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'expenses' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <DollarSign className="w-5 h-5" />
            Despesas
          </button>

          <button 
            onClick={() => setActiveTab('sales')}
            className={`${!canAccess('sales') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'sales' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <TrendingUp className="w-5 h-5" />
            Vendas
          </button>

          <button 
            onClick={() => setActiveTab('suppliers')}
            className={`${!canAccess('suppliers') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'suppliers' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <Building2 className="w-5 h-5" />
            Fornecedores
          </button>

          <button 
            onClick={() => setActiveTab('payables')}
            className={`${!canAccess('payables') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'payables' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <ClipboardList className="w-5 h-5" />
            Contas a Pagar
          </button>

          <button 
            onClick={() => setActiveTab('receivables')}
            className={`${!canAccess('receivables') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'receivables' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <DollarSign className="w-5 h-5" />
            Contas a Receber
          </button>

          <button 
            onClick={() => setActiveTab('invoices')}
            className={`${!canAccess('invoices') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'invoices' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <FileText className="w-5 h-5" />
            Notas Fiscais
          </button>

          <button 
            onClick={() => setActiveTab('budgets')}
            className={`${!canAccess('budgets') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'budgets' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <ClipboardList className="w-5 h-5" />
            Orcamentos
          </button>

          <button 
            onClick={() => setActiveTab('employees')}
            className={`${!canAccess('employees') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mb-1 ${activeTab === 'employees' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <UserCog className="w-5 h-5" />
            Funcionarios
          </button>

          <button 
            onClick={() => setActiveTab('analysis')}
            className={`${!canAccess('analysis') ? 'hidden ' : ''}w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${activeTab === 'analysis' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
          >
            <PieChart className="w-5 h-5" />
            Análise de Custo
          </button>
          {canAccessUsersArea() && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all mt-1 ${activeTab === 'users' ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-100'}`}
            >
              <UserCog className="w-5 h-5" />
              Usuarios
            </button>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 mt-auto">
          <div className="text-xs text-zinc-500">
            Danix para gestão, controle e resultados.<br />
            Versão 1.0 • {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-main ml-72 min-h-screen">
        {/* Top Navigation */}
        <div className="min-h-16 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-lg flex items-center px-8 py-2 z-50 sticky top-0">
          <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-8">
              <h1 className="hidden">
                {activeTab === 'dashboard' && 'Dashboard Financeiro'}
                {activeTab === 'properties' && 'Portfolio de Imóveis'}
                {activeTab === 'expenses' && 'Registro de Gastos'}
                {activeTab === 'sales' && 'Registro de Vendas'}
                {activeTab === 'suppliers' && 'Cadastro de Fornecedores'}
                {activeTab === 'payables' && 'Contas a Pagar'}
                {activeTab === 'receivables' && 'Contas a Receber'}
                {activeTab === 'invoices' && 'Notas Fiscais'}
                {activeTab === 'budgets' && 'Orcamentos'}
                {activeTab === 'employees' && 'Funcionarios'}
                {activeTab === 'analysis' && 'Análise de Custo'}
                {activeTab === 'users' && 'Usuarios e Permissoes'}
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div data-testid="top-user-summary" className="top-user-summary hidden xl:flex min-h-12 max-w-72 flex-col justify-center rounded-2xl border border-zinc-700 bg-zinc-800/70 px-4 py-2 text-right shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[1.8px] text-zinc-500">USUARIO</div>
                <div className="clip-soft text-sm font-semibold leading-5 text-white" title={currentUser.displayName}>{currentUser.displayName}</div>
              </div>
              <select
                value={appTheme}
                onChange={event => setAppTheme(event.target.value as AppTheme)}
                className="bg-zinc-800 text-sm border border-zinc-700 rounded-3xl px-4 py-3 outline-none"
                aria-label="Tema do aplicativo"
                title="Tema do aplicativo"
              >
                <option value="light-blue">Tema claro</option>
                <option value="dark">Tema escuro</option>
              </select>
              <label className="px-4 py-3 rounded-2xl border border-zinc-700 hover:bg-zinc-800 transition-all text-xs text-zinc-300 cursor-pointer" title="Logo usada nos relatorios PDF">
                Logo
                <input type="file" accept="image/*,.ico" onChange={handleExportLogoUpload} className="hidden" />
              </label>
              <button type="button" onClick={lockApp} className="p-3 rounded-2xl border border-zinc-700 hover:bg-zinc-800 transition-all" title="Bloquear aplicativo">
                <Lock className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => void logout()} className="p-3 rounded-2xl border border-zinc-700 hover:bg-zinc-800 transition-all" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
              <div className="flex flex-wrap items-center bg-zinc-800 rounded-3xl text-sm">
                <input 
                  type="date" 
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="bg-transparent px-4 py-2 outline-none text-zinc-400"
                />
                <span className="text-zinc-600">até</span>
                <input 
                  type="date" 
                  value={dateRange.to}
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                  className="bg-transparent px-4 py-2 outline-none text-zinc-400"
                />
              </div>

              <select 
                value={selectedProperty || ''}
                onChange={(e) => setSelectedProperty(e.target.value ? parseInt(e.target.value) : null)}
                className="max-w-full bg-zinc-800 text-sm border border-zinc-700 rounded-3xl px-5 py-2 outline-none"
              >
                <option value="">Todos os Imóveis</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Dashboard flexivel</div>
                  <div className="text-xs text-zinc-500">Oculte ou reexiba blocos sem alterar os dados salvos.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(dashboardWidgetLabels) as DashboardWidgetKey[]).map(widget => (
                    <button
                      key={widget}
                      type="button"
                      onClick={() => toggleDashboardWidget(widget)}
                      className={`filter-chip ${dashboardWidgets[widget] ? 'filter-chip-active' : ''}`}
                    >
                      {dashboardWidgets[widget] ? 'Exibindo ' : 'Mostrar '}
                      {dashboardWidgetLabels[widget]}
                    </button>
                  ))}
                </div>
              </div>

              {upcomingDuePayables.length > 0 && (
                <div className="rounded-3xl border border-amber-400/35 bg-amber-300/15 p-5 shadow-xl">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 ${appTheme === 'light-blue' ? 'text-amber-700' : 'text-amber-300'}`}>
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${appTheme === 'light-blue' ? 'text-amber-950' : 'text-amber-100'}`}>Contas proximas do vencimento</div>
                        <div className={`mt-1 text-sm ${appTheme === 'light-blue' ? 'text-amber-900' : 'text-amber-100/75'}`}>
                          {upcomingDuePayables.length} conta(s) vencem nos proximos 7 dias, totalizando {formatCurrency(upcomingDueTotal)}.
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {upcomingDuePayables.slice(0, 3).map(payable => (
                        <div key={payable.id} className={`rounded-2xl border border-amber-300/30 px-4 py-3 text-xs ${appTheme === 'light-blue' ? 'bg-white/70 text-amber-950' : 'bg-zinc-950/40 text-amber-50'}`}>
                          <div className="max-w-44 truncate font-semibold">{payable.product || payable.services || getPayableSupplierName(payable)}</div>
                          <div className={`mt-1 ${appTheme === 'light-blue' ? 'text-amber-800' : 'text-amber-100/70'}`}>{format(parseLocalDate(payable.dueDate), 'dd/MM/yyyy')} - {formatCurrency(payable.amount)}</div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setActiveTab('payables')} className="rounded-3xl bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition-all hover:bg-amber-200">
                        Ver contas
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI Cards */}
              <div className={`${dashboardWidgets.kpis ? '' : 'hidden '}dashboard-widget grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6`}>
                <button type="button" onClick={() => toggleDashboardWidget('kpis')} className="dashboard-hide-button absolute right-2 top-2 z-10 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                  <EyeOff className="inline h-3.5 w-3.5 mr-1" /> Ocultar
                </button>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-zinc-500">Total de Gastos</p>
                      <p className="text-4xl font-semibold text-white mt-3">
                        {formatCurrency(totalCosts)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                  <div className="mt-6 text-xs text-emerald-400 flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    Atualizado agora
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-zinc-500">Contas em Aberto</p>
                      <p className="text-4xl font-semibold text-white mt-3">
                        {formatCurrency(openPayables)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-violet-500/10 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-violet-400" />
                    </div>
                  </div>
                  <div className="text-emerald-400 text-sm mt-8 font-medium">
                    {filteredPayables.filter(item => item.status === 'open').length} pendentes
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-zinc-500">Contas Atrasadas</p>
                      <p className="text-4xl font-semibold mt-3 text-red-400">
                        {formatCurrency(filteredPayables.filter(item => item.status === 'overdue').reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0))}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-500/10">
                      <FileText className="w-6 h-6 text-red-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Contas Pagas</p>
                      <p className="text-4xl font-semibold text-amber-400 mt-3">
                        {filteredPayables.filter(item => item.status === 'paid').length}
                      </p>
                    </div>
                    <FileText className="w-9 h-9 text-amber-400/70" />
                  </div>
                  <div className="mt-10 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-violet-500 w-[73%]"></div>
                  </div>
                </div>
              </div>

              <div className={`${dashboardWidgets.charts ? '' : 'hidden '}dashboard-widget grid grid-cols-1 xl:grid-cols-3 gap-6`}>
                <button type="button" onClick={() => toggleDashboardWidget('charts')} className="dashboard-hide-button absolute right-2 top-2 z-10 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                  <EyeOff className="inline h-3.5 w-3.5 mr-1" /> Ocultar
                </button>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-white">Escada de gastos</h3>
                    <p className="text-xs text-zinc-500">Categorias por valor</p>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={expensesByCategory.slice(0, 6)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} interval={0} height={44} tickFormatter={(value) => String(value).slice(0, 10)} />
                        <YAxis tick={{ fontSize: 10, fill: '#71717a' }} width={48} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-white">Status das contas</h3>
                    <p className="text-xs text-zinc-500">Distribuicao por valor</p>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={payableStatusChartData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                          {payableStatusChartData.map(item => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                    {payableStatusChartData.map(item => <span key={item.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-white">Evolucao mensal</h3>
                    <p className="text-xs text-zinc-500">Despesas e contas</p>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyCostChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#71717a' }} width={48} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} />
                        <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee33" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Expenses by Category */}
                <div className={`${dashboardWidgets.categories ? '' : 'hidden '}dashboard-widget lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-8`}>
                  <button type="button" onClick={() => toggleDashboardWidget('categories')} className="dashboard-hide-button absolute right-4 top-4 z-10 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                    <EyeOff className="inline h-3.5 w-3.5 mr-1" /> Ocultar
                  </button>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-semibold">Gastos por Categoria</h3>
                    <div className="text-xs px-4 py-1.5 bg-zinc-800 rounded-3xl text-zinc-400">Período selecionado</div>
                  </div>
                  
                  <div className="space-y-6">
                    {expensesByCategory.length > 0 ? expensesByCategory.map((cat, index) => (
                      <div key={index} className="flex items-center gap-5">
                        <div className="w-28 text-sm font-medium text-zinc-400">{cat.name}</div>
                        <div className="flex-1 h-3 bg-zinc-800 rounded-3xl overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-3xl"
                            style={{ 
                              width: `${Math.max(8, (cat.value / Math.max(...expensesByCategory.map(c => c.value))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        <div className="font-mono text-sm w-24 text-right text-white">
                          {formatCurrency(cat.value)}
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center text-zinc-500">Nenhuma despesa registrada no período</div>
                    )}
                  </div>
                </div>

                {/* Properties Overview */}
                <div className={`${dashboardWidgets.properties ? '' : 'hidden '}dashboard-widget lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-8`}>
                  <button type="button" onClick={() => toggleDashboardWidget('properties')} className="dashboard-hide-button absolute right-4 top-4 z-10 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                    <EyeOff className="inline h-3.5 w-3.5 mr-1" /> Ocultar
                  </button>
                  <h3 className="text-lg font-semibold mb-6">Seus Imóveis</h3>
                  
                  <div className="space-y-4">
                    {propertyStats.slice(0, 4).map((prop, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPropertyDetailId(prop.id);
                          setActiveTab('properties');
                        }}
                        className="w-full flex justify-between items-center border border-zinc-800 hover:border-violet-500/30 p-4 rounded-2xl transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(prop.status)}`}></div>
                          <div>
                            <div className="font-medium text-white group-hover:text-violet-300 transition-colors">{prop.name}</div>
                            <div className="text-xs text-zinc-500 line-clamp-1">{prop.address}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-emerald-400 font-medium text-sm">{formatCurrency(prop.paidPayablesValue)}</div>
                          <div className="text-[10px] text-zinc-500">pago</div>
                        </div>
                      </button>
                    ))}
                    
                    {propertyStats.length === 0 && (
                      <div className="text-center py-10 text-zinc-500 text-sm">Adicione seu primeiro imóvel</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={`${dashboardWidgets.recent ? '' : 'hidden '}dashboard-widget bg-zinc-900 border border-zinc-800 rounded-3xl p-8`}>
                <button type="button" onClick={() => toggleDashboardWidget('recent')} className="dashboard-hide-button absolute right-4 top-4 z-10 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
                  <EyeOff className="inline h-3.5 w-3.5 mr-1" /> Ocultar
                </button>
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-semibold">Atividade Recente</h3>
                  <button onClick={() => setActiveTab('expenses')} className="text-xs text-violet-400 flex items-center gap-1 hover:text-violet-300">
                    VER TODOS <span className="text-lg leading-none">→</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredExpenses.slice(0, 4).map((exp, index) => (
                    <div key={index} className="flex gap-4 p-5 bg-zinc-950 border border-zinc-800 rounded-2xl">
                      <div className="mt-1">
                        <div className="w-8 h-8 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center">
                          ↓
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{exp.item}</div>
                        <div className="text-xs text-zinc-500">{exp.category} • {format(parseLocalDate(exp.purchaseDate), 'dd/MM/yyyy')}</div>
                        {exp.invoiceNumber && <div className="text-[10px] text-zinc-600 mt-1">NF: {exp.invoiceNumber}</div>}
                      </div>
                      <div className="font-mono text-red-400 text-right whitespace-nowrap">- {formatCurrency(exp.amount)}</div>
                    </div>
                  ))}
                  
                  {filteredSales.slice(0, 3).map((sale, index) => (
                    <div key={index} className="flex gap-4 p-5 bg-zinc-950 border border-emerald-900/60 rounded-2xl">
                      <div className="mt-1">
                        <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center">
                          ↑
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-emerald-300">Venda Realizada</div>
                        <div className="text-xs text-zinc-500">{format(parseLocalDate(sale.saleDate), 'dd/MM/yyyy')}</div>
                      </div>
                      <div className="font-mono text-emerald-400 text-right whitespace-nowrap">+ {formatCurrency(sale.salePrice)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PROPERTIES TAB */}
          {activeTab === 'properties' && (
            <div>
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-3xl font-semibold">Meus Imóveis</h2>
                  <p className="text-zinc-500">Gerencie seu portfólio de propriedades</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['all', 'Todos'],
                      ['owned', 'Carteira'],
                      ['under_reform', 'Reforma'],
                      ['sold', 'Vendido'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPropertyStatusFilter(value)}
                        className={`filter-chip ${propertyStatusFilter === value ? 'filter-chip-active' : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={propertySearch} onChange={event => setPropertySearch(event.target.value)} placeholder="Pesquisar imóveis" className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl pl-11 pr-5 py-3 outline-none text-sm" />
                  </div>
                  <button 
                    onClick={() => openCreateForm('property')}
                    className="flex items-center gap-2 bg-white text-zinc-950 px-6 py-3 rounded-3xl font-medium hover:bg-zinc-100 transition-all active:scale-[0.985]"
                  >
                    <Plus className="w-4 h-4" /> NOVO IMÓVEL
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {filteredPropertyStats.map((prop) => (
                  <React.Fragment key={prop.id}>
                  <div
                    onClick={() => setPropertyDetailId(prop.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPropertyDetailId(prop.id);
                      }
                    }}
                    className={`property-row ${propertyDetailId === prop.id ? 'is-selected-row ' : ''}bg-zinc-900 border ${propertyDetailId === prop.id ? 'border-blue-400/60' : 'border-zinc-700'} hover:border-blue-500/40 rounded-2xl p-5 group cursor-pointer transition-all shadow-[0_18px_55px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.22)]`}
                  >
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                      <div className="flex flex-col md:flex-row md:items-start gap-4 min-w-0">
                        <div className={`inline-flex items-center text-xs uppercase tracking-widest px-4 py-1.5 rounded-3xl ${getStatusColor(prop.status)}`}>
                          {getStatusLabel(prop.status)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              editProperty(prop);
                            }}
                            className="p-2 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-amber-400"
                            title="Editar imóvel"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteProperty(prop.id);
                            }}
                            className="p-2 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-red-400"
                            title="Excluir imóvel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-7 gap-y-3 text-right xl:min-w-[560px]">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Pago</div>
                          <div className="font-mono text-lg text-emerald-300 mt-1">{formatCurrency(prop.paidPayablesValue)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Em aberto</div>
                          <div className="font-mono text-lg text-amber-300 mt-1">{formatCurrency(prop.openPayablesValue)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Atrasado</div>
                          <div className="font-mono text-lg text-rose-300 mt-1">{formatCurrency(prop.overduePayablesValue)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 xl:mt-0 xl:flex-1">
                      <div className="text-xl font-semibold leading-none text-white">{prop.name}</div>
                      <div className="text-sm text-zinc-400 mt-2 line-clamp-2">{prop.address}</div>
                    </div>

                    <div className="hidden">
                      <div>
                        <div className="text-xs text-zinc-500">GASTOS</div>
                        <div className="font-mono mt-1 text-orange-300">{formatCurrency(prop.additionalExpenses)}</div>
                        <div className="text-xs text-zinc-500 mt-4">DATA</div>
                        <div className="font-medium">{format(parseLocalDate(prop.purchaseDate), 'dd/MM/yyyy')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">FORNECEDORES</div>
                        <div className="font-mono mt-1 text-violet-300">{suppliers.filter(supplier => supplier.propertyId === prop.id).length}</div>
                        <div className="text-xs text-zinc-500 mt-4">CONTAS</div>
                        <div className="font-medium">{payables.filter(payable => payable.propertyId === prop.id).length}</div>
                      </div>
                    </div>
                  </div>
                  {propertyDetailId === prop.id && propertyDetail && (
                    <div className="property-detail-panel -mt-1 mb-7 bg-zinc-900 border border-violet-500/30 rounded-3xl p-5 md:p-6">
                      <div className="flex items-start justify-between gap-6 mb-5">
                        <div>
                          <div className="text-xs text-violet-300 uppercase tracking-[2px] mb-2">Detalhes do imovel</div>
                          <h3 className="text-2xl font-semibold text-white">{propertyDetail.name}</h3>
                          <p className="text-zinc-400 mt-2">{propertyDetail.address}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-3">
                          <button type="button" onClick={() => editProperty(propertyDetail)} className="px-5 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm font-medium transition-all">Editar</button>
                          <button type="button" onClick={() => setPropertyDetailId(null)} className="px-5 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm font-medium transition-all">Fechar</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                          <div className="text-xs text-zinc-500">Despesas</div>
                          <div className="font-mono text-lg text-orange-300 mt-2">{formatCurrency(propertyDetail.directExpenses)}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                          <div className="text-xs text-zinc-500">Contas a pagar</div>
                          <div className="font-mono text-lg text-amber-300 mt-2">{formatCurrency(propertyDetail.payableExpenses)}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                          <div className="text-xs text-zinc-500">Total gasto</div>
                          <div className="font-mono text-lg text-orange-300 mt-2">{formatCurrency(propertyDetail.additionalExpenses)}</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                          <div className="text-xs text-zinc-500">Fornecedores</div>
                          <div className="font-mono text-lg text-violet-300 mt-2">{propertyDetailSuppliers.length}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <div className="font-semibold">Despesas e servicos vinculados</div>
                            <div className="text-xs text-zinc-500">{propertyDetailExpenses.length} item(ns)</div>
                          </div>
                          <div className="divide-y divide-zinc-800">
                            {propertyDetailExpenses.map(expense => (
                              <div key={expense.id} className="px-6 py-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="font-medium text-white truncate">{expense.item}</div>
                                  <div className="text-xs text-zinc-500">{expense.category} - {format(parseLocalDate(expense.purchaseDate), 'dd/MM/yyyy')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="font-mono text-orange-300">{formatCurrency(expense.amount)}</div>
                                  <button type="button" onClick={() => editExpense(expense)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => void deleteExpense(expense.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                            {propertyDetailExpenses.length === 0 && <div className="px-6 py-10 text-center text-zinc-500 text-sm">Nenhuma despesa vinculada.</div>}
                          </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                            <div className="font-semibold">Contas a pagar vinculadas</div>
                            <div className="text-xs text-zinc-500">{propertyDetailPayables.length} conta(s)</div>
                          </div>
                          <div className="divide-y divide-zinc-800">
                            {propertyDetailPayables.slice(0, 8).map(payable => (
                              <div key={payable.id} className="px-6 py-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="font-medium text-white truncate">{payable.product || payable.services || 'Conta sem descricao'}</div>
                                  <div className="text-xs text-zinc-500">{getPayableSupplierName(payable)} - vencimento {format(parseLocalDate(payable.dueDate), 'dd/MM/yyyy')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="font-mono text-white">{formatCurrency(payable.amount)}</div>
                                  <button type="button" onClick={() => editPayable(payable)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => void deletePayable(payable.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                            {propertyDetailPayables.length === 0 && <div className="px-6 py-10 text-center text-zinc-500 text-sm">Nenhuma conta vinculada.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </React.Fragment>
                ))}
                {filteredPropertyStats.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState title="Nenhum imovel encontrado." actionLabel="Adicionar imovel" onAction={() => openCreateForm('property')} />
                  </div>
                )}
              </div>

              {propertyDetailId === -1 && propertyDetail && (
                <div className="mt-10 bg-zinc-900 border border-violet-500/30 rounded-3xl p-8">
                  <div className="flex items-start justify-between gap-6 mb-8">
                    <div>
                      <div className="text-xs text-violet-300 uppercase tracking-[2px] mb-2">Detalhes do imovel</div>
                      <h3 className="text-3xl font-semibold text-white">{propertyDetail.name}</h3>
                      <p className="text-zinc-400 mt-2">{propertyDetail.address}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button type="button" onClick={() => editProperty(propertyDetail)} className="px-5 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm font-medium transition-all">Editar</button>
                      <button type="button" onClick={() => setPropertyDetailId(null)} className="px-5 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm font-medium transition-all">Fechar</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                      <div className="text-xs text-zinc-500">Despesas</div>
                      <div className="font-mono text-xl text-orange-300 mt-2">{formatCurrency(propertyDetail.directExpenses)}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                      <div className="text-xs text-zinc-500">Contas a pagar</div>
                      <div className="font-mono text-xl text-amber-300 mt-2">{formatCurrency(propertyDetail.payableExpenses)}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                      <div className="text-xs text-zinc-500">Total gasto</div>
                      <div className="font-mono text-xl text-orange-300 mt-2">{formatCurrency(propertyDetail.additionalExpenses)}</div>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                      <div className="text-xs text-zinc-500">Fornecedores</div>
                      <div className="font-mono text-xl text-violet-300 mt-2">{propertyDetailSuppliers.length}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="font-semibold">Despesas e servicos vinculados</div>
                        <div className="text-xs text-zinc-500">{propertyDetailExpenses.length} item(ns)</div>
                      </div>
                      <div className="divide-y divide-zinc-800">
                        {propertyDetailExpenses.map(expense => (
                          <div key={expense.id} className="px-6 py-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-medium text-white truncate">{expense.item}</div>
                              <div className="text-xs text-zinc-500">{expense.category} - {format(parseLocalDate(expense.purchaseDate), 'dd/MM/yyyy')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-orange-300">{formatCurrency(expense.amount)}</div>
                              <button type="button" onClick={() => editExpense(expense)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                              <button type="button" onClick={() => void deleteExpense(expense.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                        {propertyDetailExpenses.length === 0 && <div className="px-6 py-10 text-center text-zinc-500 text-sm">Nenhuma despesa vinculada.</div>}
                      </div>
                    </div>

                    {propertyDetailSales.length > 0 && <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                        <div className="font-semibold">Vendas do imovel</div>
                        <div className="text-xs text-zinc-500">{propertyDetailSales.length} venda(s)</div>
                      </div>
                      <div className="divide-y divide-zinc-800">
                        {propertyDetailSales.map(sale => (
                          <div key={sale.id} className="px-6 py-4 flex items-center justify-between gap-4">
                            <div>
                              <div className="font-medium text-white">{sale.buyerName || 'Comprador nao informado'}</div>
                              <div className="text-xs text-zinc-500">{format(parseLocalDate(sale.saleDate), 'dd/MM/yyyy')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-emerald-300">{formatCurrency(sale.salePrice)}</div>
                              <button type="button" onClick={() => editSale(sale)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                              <button type="button" onClick={() => void deleteSale(sale.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>}
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden mt-6">
                    <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                      <div className="font-semibold">Contas a pagar vinculadas</div>
                      <div className="text-xs text-zinc-500">{propertyDetailPayables.length} conta(s)</div>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {propertyDetailPayables.slice(0, 8).map(payable => (
                        <div key={payable.id} className="px-6 py-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{payable.product || payable.services || 'Conta sem descricao'}</div>
                            <div className="text-xs text-zinc-500">{getPayableSupplierName(payable)} - vencimento {format(parseLocalDate(payable.dueDate), 'dd/MM/yyyy')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-white">{formatCurrency(payable.amount)}</div>
                            <button type="button" onClick={() => editPayable(payable)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button type="button" onClick={() => void deletePayable(payable.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                      {propertyDetailPayables.length === 0 && <div className="px-6 py-10 text-center text-zinc-500 text-sm">Nenhuma conta vinculada.</div>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                      <div className="font-semibold mb-4">Fornecedores vinculados</div>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {propertyDetailSuppliers.slice(0, 8).map(supplier => (
                          <div key={supplier.id} className="flex items-center justify-between gap-4 text-sm">
                            <div className="min-w-0">
                              <div className="text-white truncate">{supplier.tradeName || supplier.legalName}</div>
                              <div className="text-xs text-zinc-500">{supplier.category}</div>
                            </div>
                            <button type="button" onClick={() => editSupplier(supplier)} className="text-amber-400 hover:text-amber-300 text-xs">Editar</button>
                          </div>
                        ))}
                        {propertyDetailSuppliers.length === 0 && <div className="py-8 text-center text-zinc-500 text-sm">Nenhum fornecedor vinculado.</div>}
                      </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                      <div className="font-semibold mb-4">Analise de custo do imovel</div>
                      <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {propertyDetailCostAnalysis.slice(0, 8).map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between gap-4 text-sm">
                              <div className="text-white truncate">{item.label}</div>
                              <div className="font-mono text-emerald-300">{formatCurrency(item.total)}</div>
                            </div>
                            <div className="mt-2 h-2 bg-zinc-800 rounded-3xl overflow-hidden">
                              <div className="h-full bg-violet-400" style={{ width: `${Math.max(4, item.percentage)}%` }} />
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">{item.percentage.toFixed(1)}% do total - {item.suppliers}</div>
                          </div>
                        ))}
                        {propertyDetailCostAnalysis.length === 0 && <div className="py-8 text-center text-zinc-500 text-sm">Sem despesas ou contas para analise.</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Property Form */}
              <div id="add-property-form" className={dataFormFloatingCardClass('property')}>
                <div className="mb-8 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('property')}</h3>
                  </div>
                  <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                </div>
                <h3 className="hidden">
                  {editingProperty ? 'EDITAR IMÓVEL' : 'ADICIONAR NOVO IMÓVEL'}
                </h3>
                
                <form onSubmit={handleAddProperty} className="grid grid-cols-2 gap-x-6 gap-y-8">
                  <div className="col-span-2">
                    <label className="block text-xs tracking-widest text-zinc-500 mb-2">NOME DO IMÓVEL</label>
                    <input 
                      type="text" 
                      value={newProperty.name}
                      onChange={(e) => setNewProperty({...newProperty, name: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-white rounded-2xl px-6 py-4 outline-none text-lg placeholder:text-zinc-600"
                      placeholder="Apartamento Centro - 302"
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs tracking-widest text-zinc-500 mb-2">ENDEREÇO COMPLETO</label>
                    <input 
                      type="text" 
                      value={newProperty.address}
                      onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-white rounded-2xl px-6 py-4 outline-none text-lg placeholder:text-zinc-600"
                      placeholder="Rua das Palmeiras, 234 - Centro, São Paulo - SP"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-widest text-zinc-500 mb-2">DATA DE AQUISIÇÃO</label>
                    <input 
                      type="date" 
                      value={newProperty.purchaseDate}
                      onChange={(e) => setNewProperty({...newProperty, purchaseDate: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-white rounded-2xl px-6 py-4 outline-none"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs tracking-widest text-zinc-500 mb-2">STATUS</label>
                    <select 
                      value={newProperty.status}
                      onChange={(e) => setNewProperty({...newProperty, status: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-white rounded-2xl px-6 py-4 outline-none text-lg"
                    >
                      <option value="owned">Em Carteira</option>
                      <option value="under_reform">Em Reforma</option>
                      <option value="sold">Vendido</option>
                    </select>
                  </div>

                  <div className="col-span-2 pt-4">
                    <button 
                      type="submit"
                      className="bg-white hover:bg-zinc-100 active:bg-zinc-200 w-full py-4 text-zinc-950 font-semibold rounded-3xl flex items-center justify-center gap-3 transition-all"
                    >
                      <Plus className="w-5 h-5" /> {editingProperty ? 'ATUALIZAR IMÓVEL' : 'SALVAR IMÓVEL NO PORTFÓLIO'}
                    </button>
                    {editingProperty && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProperty(null);
                          setNewProperty(emptyPropertyForm);
                        }}
                        className="mt-4 w-full py-3 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm transition-all"
                      >
                        CANCELAR EDIÇÃO
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Controle de Despesas</h2>
                  <p className="text-zinc-400">Registro completo com notas fiscais e datas</p>
                </div>
                <button type="button" onClick={() => openCreateForm('expense')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">TOTAL NO PERÍODO</div>
                  <div className="text-4xl font-semibold text-red-400 tracking-tighter">{formatCurrency(totalExpenses)}</div>
                </div>
              </div>

              <div className="relative max-w-xl mb-8">
                <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={expenseSearch}
                  onChange={event => setExpenseSearch(event.target.value)}
                  placeholder="Pesquisar despesas por item, categoria, NF, imóvel ou observação"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl pl-12 pr-5 py-3 outline-none text-sm"
                />
              </div>

              <div className="mb-8 flex flex-wrap gap-2">
                {([
                  ['all', 'Todas'],
                  ['linked', 'Com imovel'],
                  ['unlinked', 'Sem imovel'],
                  ['invoice', 'Com NF'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setExpenseQuickFilter(value)} className={`filter-chip ${expenseQuickFilter === value ? 'filter-chip-active' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Expense Form */}
              <div className={dataFormFloatingCardClass('expense')}>
                <div className="mb-8 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('expense')}</h3>
                  </div>
                  <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                </div>
                <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-8">
                  <div className="md:col-span-5">
                    <label className="text-xs text-zinc-400 block mb-3">ITEM / DESCRIÇÃO</label>
                    <input
                      type="text"
                      placeholder="Reforma banheiro - Azulejos e mão de obra"
                      value={newExpense.item}
                      onChange={(e) => setNewExpense({ ...newExpense, item: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-zinc-400"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">CATEGORIA</label>
                    <input
                      list="expense-category-options"
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      placeholder="Opcional"
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-zinc-400"
                    />
                    <datalist id="expense-category-options">
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </datalist>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">VALOR (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1249.90"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 text-lg font-mono focus:outline-none focus:border-zinc-400"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">DATA DA COMPRA</label>
                    <input
                      type="date"
                      value={newExpense.purchaseDate}
                      onChange={(e) => setNewExpense({ ...newExpense, purchaseDate: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">Nº DA NOTA FISCAL</label>
                    <input
                      type="text"
                      placeholder="NF 004821"
                      value={newExpense.invoiceNumber}
                      onChange={(e) => setNewExpense({ ...newExpense, invoiceNumber: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">DATA DA NOTA</label>
                    <input
                      type="date"
                      value={newExpense.invoiceDate}
                      onChange={(e) => setNewExpense({ ...newExpense, invoiceDate: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">IMÓVEL RELACIONADO</label>
                    <select
                      value={newExpense.propertyId}
                      onChange={(e) => setNewExpense({ ...newExpense, propertyId: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none text-sm"
                    >
                      <option value="">Não vinculado</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-12">
                    <label className="text-xs text-zinc-400 block mb-3">OBSERVAÇÕES / DETALHES</label>
                    <textarea
                      placeholder="Prestador: João Silva • Tel: (11) 98765-4321"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-6 py-5 h-28 resize-y focus:outline-none focus:border-zinc-400"
                    />
                  </div>

                  <div className="md:col-span-12 flex gap-4">
                    <button 
                      type="submit"
                      className="flex-1 bg-white text-zinc-950 py-4 font-semibold rounded-3xl flex items-center justify-center gap-2 hover:bg-amber-300 transition-all"
                    >
                      {editingExpense ? 'ATUALIZAR DESPESA' : 'REGISTRAR DESPESA'} <Plus className="w-4 h-4" />
                    </button>
                    
                    {editingExpense && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingExpense(null);
                          setNewExpense({
                            propertyId: '', category: '', item: '', amount: '', purchaseDate: format(new Date(), 'yyyy-MM-dd'),
                            invoiceNumber: '', invoiceDate: '', description: ''
                          });
                        }}
                        className="px-8 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm"
                      >
                        CANCELAR
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Expenses List */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-zinc-950">
                  <div className="font-semibold">Historico de gastos ({filteredExpenses.length})</div>
                  <div className="text-xs uppercase text-zinc-500">Ordenado por data mais recente</div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {[...filteredExpenses].sort((a, b) => parseLocalDate(b.purchaseDate).getTime() - parseLocalDate(a.purchaseDate).getTime()).map((expense) => {
                    const relatedProperty = properties.find(p => p.id === expense.propertyId);
                    return (
                      <div key={expense.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="font-semibold text-white truncate">{expense.item}</div>
                            {expense.category && (
                              <span className="px-3 py-1 text-xs rounded-full bg-zinc-800 text-zinc-300">
                                {expense.category}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                            <span>{relatedProperty ? relatedProperty.name : 'Sem imovel'}</span>
                            <span>{format(parseLocalDate(expense.purchaseDate), 'dd/MM/yyyy')}</span>
                            <span>NF: {expense.invoiceNumber || 'Sem numero'}</span>
                          </div>
                          {expense.description && <div className="mt-2 text-sm text-zinc-400 line-clamp-2">{expense.description}</div>}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 xl:justify-end">
                          <div className="text-left xl:text-right">
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Valor</div>
                            <div className="font-mono text-lg font-semibold text-red-400">{formatCurrency(expense.amount)}</div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => editExpense(expense)} className="p-3 rounded-2xl border border-zinc-800 text-amber-400 hover:bg-zinc-800 transition-colors" title="Editar despesa">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => deleteExpense(expense.id)} className="p-3 rounded-2xl border border-zinc-800 text-red-400 hover:bg-zinc-800 transition-colors" title="Excluir despesa">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredExpenses.length === 0 && (
                  <EmptyState title="Nenhuma despesa encontrada para o periodo e filtros selecionados." actionLabel="Adicionar despesa" onAction={() => openCreateForm('expense')} />
                )}
              </div>
            </div>
          )}
          {/* SALES TAB */}
          {activeTab === 'sales' && (
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between mb-8 items-end">
                <div>
                  <h2 className="font-semibold text-4xl">Vendas e Margens de Lucro</h2>
                  <p className="text-zinc-500 mt-2">Registre vendas, comissões e acompanhe o retorno do investimento</p>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 text-right">LUCRO TOTAL NO PERÍODO</div>
                  <div className="text-5xl font-semibold text-emerald-400 tracking-tighter">{formatCurrency(netProfit)}</div>
                </div>
              </div>

              <div className="relative max-w-xl mb-8">
                <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={saleSearch}
                  onChange={event => setSaleSearch(event.target.value)}
                  placeholder="Pesquisar vendas por comprador, imóvel ou observação"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl pl-12 pr-5 py-3 outline-none text-sm"
                />
              </div>

              <div className="mb-8 flex flex-wrap gap-2">
                {([
                  ['all', 'Todas'],
                  ['linked', 'Com imovel'],
                  ['unlinked', 'Sem imovel'],
                  ['buyer', 'Com comprador'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSaleQuickFilter(value)} className={`filter-chip ${saleQuickFilter === value ? 'filter-chip-active' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="mb-8 flex justify-end">
                <button type="button" onClick={() => openCreateForm('sale')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>

              <div className={dataFormFloatingCardClass('sale')}>
                <div className="mb-8 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('sale')}</h3>
                  </div>
                  <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                </div>
                <form onSubmit={handleAddSale}>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Imóvel Vendido</label>
                      <select 
                        value={newSale.propertyId} 
                        onChange={e => setNewSale({...newSale, propertyId: e.target.value})}
                        className="w-full px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700 text-lg"
                      >
                        <option value="">Venda geral / Não vinculada</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Data da Venda</label>
                      <input 
                        type="date" 
                        value={newSale.saleDate} 
                        onChange={e => setNewSale({...newSale, saleDate: e.target.value})}
                        className="w-full px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700"
                        required 
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Valor de Venda (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newSale.salePrice} 
                        onChange={e => setNewSale({...newSale, salePrice: e.target.value})}
                        className="w-full px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700 font-mono text-2xl" 
                        placeholder="890000"
                        required 
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Nome do Comprador</label>
                      <input 
                        type="text" 
                        value={newSale.buyerName} 
                        onChange={e => setNewSale({...newSale, buyerName: e.target.value})}
                        className="w-full px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700" 
                        placeholder="Maria Silva" 
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Comissão / Corretagem (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newSale.commission} 
                        onChange={e => setNewSale({...newSale, commission: e.target.value})}
                        className="w-full px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700 font-mono" 
                        placeholder="24500" 
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs uppercase text-zinc-400 tracking-wider mb-2 block">Observações</label>
                      <textarea 
                        value={newSale.notes} 
                        onChange={e => setNewSale({...newSale, notes: e.target.value})}
                        className="w-full h-28 px-6 py-5 rounded-3xl bg-zinc-950 border border-zinc-700 resize-y" 
                        placeholder="Venda com financiamento aprovado. Margem bruta excelente."
                      ></textarea>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="mt-10 bg-emerald-500 hover:bg-emerald-400 transition-colors text-emerald-950 font-semibold py-4 px-16 rounded-3xl text-lg flex items-center gap-3"
                  >
                    {editingSale ? 'ATUALIZAR VENDA' : 'REGISTRAR VENDA'} 
                    <TrendingUp className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden">
                <div className="px-6 py-5 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 bg-zinc-950">
                  <div className="font-medium">Historico de vendas</div>
                  <div className="font-mono text-emerald-400">{filteredSales.length} vendas - Total: {formatCurrency(totalSales)}</div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {[...filteredSales].sort((a, b) => parseLocalDate(b.saleDate).getTime() - parseLocalDate(a.saleDate).getTime()).map((sale) => {
                    const relatedProp = properties.find(p => p.id === sale.propertyId);
                    const expenseForProp = propertyStats.find(p => p.id === sale.propertyId)?.totalSpent || 0;
                    const margin = parseFloat(sale.salePrice) - expenseForProp - parseFloat(sale.commission || '0');

                    return (
                      <div key={sale.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-emerald-400 font-semibold text-xl tracking-tight">{formatCurrency(sale.salePrice)}</div>
                            <span className="px-3 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300">
                              {format(parseLocalDate(sale.saleDate), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                            <span>{relatedProp ? relatedProp.name : 'Sem imovel'}</span>
                            {sale.buyerName && <span>Comprador: {sale.buyerName}</span>}
                          </div>
                          {sale.notes && <div className="mt-2 text-sm text-zinc-400 line-clamp-2">{sale.notes}</div>}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-5 xl:justify-end">
                          <div className="text-left xl:text-right">
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Comissao</div>
                            <div className="font-mono font-medium text-rose-400">{formatCurrency(sale.commission || 0)}</div>
                          </div>
                          <div className="text-left xl:text-right">
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Margem liquida</div>
                            <div className={`font-mono text-lg font-semibold ${margin > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatCurrency(margin)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => editSale(sale)} className="p-3 rounded-2xl border border-zinc-800 text-amber-400 hover:bg-zinc-800 transition-colors" title="Editar venda">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => deleteSale(sale.id)} className="p-3 rounded-2xl border border-zinc-800 text-red-400 hover:bg-zinc-800 transition-colors" title="Excluir venda">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredSales.length === 0 && <EmptyState title="Nenhuma venda registrada." actionLabel="Adicionar venda" onAction={() => openCreateForm('sale')} />}
              </div>
            </div>
          )}
          {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Fornecedores</h2>
                  <p className="text-zinc-400">Cadastro organizado de empresas e prestadores recorrentes</p>
                </div>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => openCreateForm('supplier')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">TOTAL CADASTRADO</div>
                    <div className="text-4xl font-semibold text-white">{filteredSuppliers.length}</div>
                  </div>
                </div>
              </div>

              <div className="relative max-w-xl mb-8">
                <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={supplierSearch}
                  onChange={event => setSupplierSearch(event.target.value)}
                  placeholder="Pesquisar fornecedores por nome, CNPJ, contato, categoria ou imóvel"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl pl-12 pr-5 py-3 outline-none text-sm"
                />
              </div>
              <div className="mb-8 flex flex-wrap gap-2">
                {([
                  ['all', 'Todos'],
                  ['open', 'Em aberto'],
                  ['paid', 'Pago'],
                  ['overdue', 'Atrasado'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSupplierStatusFilter(value)}
                    className={`filter-chip ${supplierStatusFilter === value ? 'filter-chip-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={dataFormFloatingCardClass('supplier')}>
                <div className="mb-8 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('supplier')}</h3>
                  </div>
                  <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                </div>
                <form onSubmit={handleAddSupplier} className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-7">
                  <div className="md:col-span-6">
                    <label className="text-xs text-zinc-400 block mb-3">RAZÃO SOCIAL</label>
                    <input value={newSupplier.legalName} onChange={e => setNewSupplier({...newSupplier, legalName: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" required />
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-xs text-zinc-400 block mb-3">NOME FANTASIA</label>
                    <input value={newSupplier.tradeName} onChange={e => setNewSupplier({...newSupplier, tradeName: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">CNPJ</label>
                    <input value={newSupplier.cnpj} onChange={e => setNewSupplier({...newSupplier, cnpj: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none font-mono" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">TELEFONE</label>
                    <input value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">E-MAIL</label>
                    <input type="email" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">CATEGORIA</label>
                    <input list="supplier-category-options" value={newSupplier.category} onChange={e => setNewSupplier({...newSupplier, category: e.target.value})} placeholder="Opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                    <datalist id="supplier-category-options">
                      {SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                    </datalist>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">STATUS</label>
                    <select value={newSupplier.status} onChange={e => setNewSupplier({...newSupplier, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none">
                      <option value="open">Em aberto</option>
                      <option value="paid">Pago</option>
                      <option value="overdue">Atrasado</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">IMOVEL RELACIONADO</label>
                    <select value={newSupplier.propertyId} onChange={e => setNewSupplier({...newSupplier, propertyId: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none">
                      <option value="">Nao vinculado</option>
                      {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-xs text-zinc-400 block mb-3">OBSERVAÇÃO</label>
                    <input value={newSupplier.observation} onChange={e => setNewSupplier({...newSupplier, observation: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-12 flex gap-4">
                    <button type="submit" className="flex-1 bg-white text-zinc-950 py-4 font-semibold rounded-3xl hover:bg-zinc-100 transition-all">
                      {editingSupplier ? 'ATUALIZAR FORNECEDOR' : 'SALVAR FORNECEDOR'}
                    </button>
                    {editingSupplier && (
                      <button type="button" onClick={() => { setEditingSupplier(null); setNewSupplier(emptySupplierForm); }} className="px-8 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm">
                        CANCELAR
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between gap-5">
                  <div>
                    <div className="font-semibold">Fornecedores cadastrados</div>
                    <div className="text-xs text-zinc-500">{filteredSuppliers.length} registro(s) encontrados</div>
                  </div>
                  <div className="text-xs text-zinc-500">Lista compacta</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {filteredSuppliers.map(supplier => {
                    const relatedProperty = properties.find(property => property.id === supplier.propertyId);
                    const contact = [supplier.phone, supplier.email].filter(Boolean).join(' • ') || 'Sem contato';
                    return (
                      <div key={supplier.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="font-semibold text-white truncate">{supplier.tradeName || supplier.legalName}</div>
                            <span className={`px-3 py-1 rounded-3xl text-xs font-medium ${getPaymentStatusColor(supplier.status)}`}>
                              {getPaymentStatusLabel(supplier.status)}
                            </span>
                          </div>
                          {supplier.tradeName && <div className="text-xs text-zinc-500 mt-1 truncate">{supplier.legalName}</div>}
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                            <span>{supplier.category || 'Sem categoria'}</span>
                            <span>{relatedProperty?.name || 'Sem imovel'}</span>
                            {supplier.cnpj && <span className="font-mono">CNPJ: {supplier.cnpj}</span>}
                          </div>
                        </div>
                        <div className="min-w-0 xl:w-80 text-sm text-zinc-400">
                          <div className="truncate">{contact}</div>
                          {supplier.observation && <div className="mt-1 text-xs text-zinc-500 truncate">{supplier.observation}</div>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button onClick={() => editSupplier(supplier)} className="p-2 border border-zinc-700 hover:bg-zinc-800 rounded-xl text-amber-400" title="Editar fornecedor"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteSupplier(supplier.id)} className="p-2 border border-zinc-700 hover:bg-zinc-800 rounded-xl text-red-400" title="Excluir fornecedor"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredSuppliers.length === 0 && (
                    <EmptyState title="Nenhum fornecedor encontrado." actionLabel="Adicionar fornecedor" onAction={() => openCreateForm('supplier')} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAYABLES TAB */}
          {activeTab === 'payables' && (
            <div className="max-w-7xl mx-auto">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Contas a Pagar</h2>
                  <p className="text-zinc-400">Registre, consulte e exporte fornecedores, contas e análise de custo</p>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => openCreateForm('payable')} className="flex items-center gap-2 bg-white text-zinc-950 hover:bg-zinc-100 px-5 py-3 rounded-3xl text-sm font-semibold transition-all">
                    <Plus className="w-4 h-4" /> ADICIONAR
                  </button>
                  <div className={`${!canAccess('export') ? 'hidden ' : ''}flex gap-3`}>
                  <button onClick={exportReportToPdf} className="flex items-center gap-2 border border-zinc-700 hover:bg-zinc-800 px-5 py-3 rounded-3xl text-sm font-medium transition-all">
                    <FileText className="w-4 h-4" /> EXPORTAR PDF
                  </button>
                  <button onClick={() => setCustomPdfOpen(true)} className="custom-pdf-button flex items-center gap-2 border px-5 py-3 rounded-3xl text-sm font-semibold transition-all">
                    <FileText className="w-4 h-4" /> PDF PERSONALIZADO
                  </button>
                  <select
                    value={excelExportFormat}
                    onChange={event => setExcelExportFormat(event.target.value as 'xlsx' | 'xml')}
                    className="bg-zinc-950 border border-zinc-700 rounded-3xl px-4 py-3 text-sm outline-none"
                    aria-label="Formato do Excel"
                  >
                    <option value="xlsx">XLSX</option>
                    <option value="xml">XML</option>
                  </select>
                  <button onClick={exportReportToExcel} className="flex items-center gap-2 bg-white text-zinc-950 hover:bg-zinc-100 px-5 py-3 rounded-3xl text-sm font-semibold transition-all">
                    <ClipboardList className="w-4 h-4" /> EXPORTAR EXCEL
                  </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
                  <div className="text-xs text-zinc-500">TOTAL NO PERÍODO</div>
                  <div className="text-3xl font-semibold text-white mt-2">{formatCurrency(totalPayables)}</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
                  <div className="text-xs text-zinc-500">EM ABERTO</div>
                  <div className="text-3xl font-semibold text-amber-400 mt-2">{formatCurrency(pendingPayables)}</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
                  <div className="text-xs text-zinc-500">ATRASADAS</div>
                  <div className="text-3xl font-semibold text-rose-400 mt-2">{formatCurrency(overduePayables)}</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
                  <div className="text-xs text-zinc-500">CONTAS ENCONTRADAS</div>
                  <div className="text-3xl font-semibold text-violet-300 mt-2">{filteredPayables.length}</div>
                </div>
              </div>

              <div className={dataFormFloatingCardClass('payable')}>
                <div className="mb-8 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('payable')}</h3>
                  </div>
                  <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                </div>
                <form onSubmit={handleAddPayable} className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-7">
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">IMOVEL RELACIONADO</label>
                    <select value={newPayable.propertyId} onChange={e => setNewPayable({...newPayable, propertyId: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none">
                      <option value="">Nao vinculado</option>
                      {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">FORNECEDOR</label>
                    <input
                      list="supplier-options"
                      value={newPayable.supplierName}
                      onChange={e => {
                        const supplierName = e.target.value;
                        const matchedSupplier = suppliers.find(supplier => (supplier.tradeName || supplier.legalName).toLowerCase() === supplierName.trim().toLowerCase());
                        setNewPayable({
                          ...newPayable,
                          supplierName,
                          supplierId: matchedSupplier ? matchedSupplier.id.toString() : '',
                        });
                      }}
                      placeholder="Digite ou selecione um fornecedor"
                      className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none"
                    />
                    <datalist id="supplier-options">
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.tradeName || supplier.legalName} />
                      ))}
                    </datalist>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">PRODUTO</label>
                    <input value={newPayable.product} onChange={e => setNewPayable({...newPayable, product: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">SERVIÇOS</label>
                    <input value={newPayable.services} onChange={e => setNewPayable({...newPayable, services: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">DATA DA COMPRA</label>
                    <input type="date" value={newPayable.purchaseDate} onChange={e => setNewPayable({...newPayable, purchaseDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" required />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">VALOR</label>
                    <input type="number" step="0.01" value={newPayable.amount} onChange={e => setNewPayable({...newPayable, amount: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none font-mono" required />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">DATA DA NF</label>
                    <input type="date" value={newPayable.invoiceDate} onChange={e => setNewPayable({...newPayable, invoiceDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">NÚMERO NF / REC</label>
                    <input value={newPayable.invoiceNumber} onChange={e => setNewPayable({...newPayable, invoiceNumber: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none font-mono" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">PRAZO</label>
                    <input value={calculateTermFromToday(newPayable.dueDate)} readOnly placeholder="Calculado pelo vencimento" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none text-zinc-400" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">FORMA DE PAGAMENTO</label>
                    <select value={newPayable.paymentMethod} onChange={e => setNewPayable({...newPayable, paymentMethod: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none">
                      {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">VENCIMENTO</label>
                    <input type="date" value={newPayable.dueDate} onChange={e => setNewPayable({...newPayable, dueDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" required />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">PARCELAS</label>
                    <input type="number" min="1" value={newPayable.installmentTotal} onChange={e => setNewPayable({...newPayable, installmentTotal: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" disabled={Boolean(editingPayable)} />
                  </div>
                  <div className="md:col-span-6">
                    <label className="text-xs text-zinc-400 block mb-3">DATAS DAS PARCELAS OPCIONAIS</label>
                    <input value={newPayable.installmentDates} onChange={e => setNewPayable({...newPayable, installmentDates: e.target.value})} placeholder="AAAA-MM-DD, AAAA-MM-DD..." className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none" disabled={Boolean(editingPayable)} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-zinc-400 block mb-3">STATUS</label>
                    <select value={newPayable.status} onChange={e => setNewPayable({...newPayable, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-6 py-4 outline-none">
                      <option value="open">Em aberto</option>
                      <option value="paid">Pago</option>
                      <option value="overdue">Atrasado</option>
                    </select>
                  </div>
                  <div className="md:col-span-12">
                    <label className="text-xs text-zinc-400 block mb-3">OBSERVAÇÃO</label>
                    <textarea value={newPayable.observation} onChange={e => setNewPayable({...newPayable, observation: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-6 py-5 h-24 resize-y outline-none" />
                  </div>
                  <div className="md:col-span-12 flex gap-4">
                    <button type="submit" className="flex-1 bg-white text-zinc-950 py-4 font-semibold rounded-3xl hover:bg-zinc-100 transition-all">
                      {editingPayable ? 'ATUALIZAR CONTA' : 'REGISTRAR CONTA'}
                    </button>
                    {editingPayable && (
                      <button type="button" onClick={() => { setEditingPayable(null); setNewPayable(emptyPayableForm); }} className="px-8 border border-zinc-700 hover:bg-zinc-800 rounded-3xl text-sm">
                        CANCELAR
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="px-8 py-6 border-b border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-zinc-950">
                  <div>
                    <div className="font-semibold">CONSULTAR CONTAS</div>
                    <div className="text-xs text-zinc-500">Pesquise por fornecedor, produto, serviço, NF, forma de pagamento ou status</div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                      {([
                        ['all', 'Todos'],
                        ['open', 'Pendentes'],
                        ['paid', 'Pago'],
                        ['overdue', 'Vencidos'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPayableStatusFilter(value)}
                          className={`filter-chip ${payableStatusFilter === value ? 'filter-chip-active' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Pesquisar contas" className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl pl-11 pr-5 py-3 outline-none text-sm" />
                  </div>
                  </div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {[...filteredPayables].sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime()).map(payable => {
                    const productOrService = payable.product || payable.services || 'Conta sem descricao';
                    return (
                      <div key={payable.id} className="floating-row payable-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="font-semibold text-white truncate">{productOrService}</div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payable.status)}`}>
                              {getPaymentStatusLabel(payable.status)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                            <span>{getPayableSupplierName(payable)}</span>
                            <span>Compra: {format(parseLocalDate(payable.purchaseDate), 'dd/MM/yyyy')}</span>
                            <span>Vencimento: {format(parseLocalDate(payable.dueDate), 'dd/MM/yyyy')}</span>
                            <span>NF/REC: {payable.invoiceNumber || 'Sem numero'}</span>
                          </div>
                          {payable.product && payable.services && <div className="mt-2 text-sm text-zinc-400 line-clamp-1">{payable.services}</div>}
                          {payable.installmentTotal && payable.installmentTotal > 1 && <div className="mt-2 text-xs text-zinc-500">Parcela {payable.installmentNumber || '-'} de {payable.installmentTotal}</div>}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 xl:justify-end">
                          <div className="text-left xl:text-right">
                            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Valor</div>
                            <div className="font-mono text-lg font-semibold text-white">{formatCurrency(payable.amount)}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button type="button" onClick={() => markPayablePaid(payable)} className={`px-3 py-2 border rounded-xl text-xs font-medium transition-colors ${payable.status === 'paid' ? 'border-zinc-600 text-zinc-400 hover:bg-zinc-800' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}>
                              {payable.status === 'paid' ? 'DESMARCAR' : 'PAGO'}
                            </button>
                            <button type="button" onClick={() => editPayable(payable)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors" title="Editar conta"><Edit2 className="w-4 h-4" /></button>
                            <button type="button" onClick={() => deletePayable(payable.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors" title="Excluir conta"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredPayables.length === 0 && <EmptyState title="Nenhuma conta encontrada." actionLabel="Adicionar conta" onAction={() => openCreateForm('payable')} />}
              </div>
            </div>
          )}

          {/* RECEIVABLES TAB */}
          {activeTab === 'receivables' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Contas a Receber</h2>
                  <p className="text-zinc-400">Controle recebimentos por cliente, imóvel e período.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => openCreateForm('receivable')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-2xl text-xs font-semibold hover:bg-zinc-100 transition-all">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                  {(['all', 'day', 'week', 'month', 'year'] as const).map(period => (
                    <button key={period} onClick={() => setReceivablePeriod(period)} className={`filter-chip ${receivablePeriod === period ? 'filter-chip-active' : ''}`}>
                      {period === 'all' ? 'Tudo' : period === 'day' ? 'Dia' : period === 'week' ? 'Semana' : period === 'month' ? 'Mês' : 'Ano'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <form onSubmit={handleSaveReceivable} className={`${dataFormFloatingCardClass('receivable')} space-y-5`}>
                  <div className="mb-8 flex items-start justify-between gap-5">
                    <div>
                      <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('receivable')}</h3>
                    </div>
                    <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                  </div>
                  <input value={newReceivable.clientName} onChange={e => setNewReceivable({...newReceivable, clientName: e.target.value})} placeholder="Cliente opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <select value={newReceivable.propertyId} onChange={e => setNewReceivable({...newReceivable, propertyId: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                    <option value="">Sem imóvel relacionado</option>
                    {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                  </select>
                  <input value={newReceivable.description} onChange={e => setNewReceivable({...newReceivable, description: e.target.value})} placeholder="Descrição" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" step="0.01" value={newReceivable.amount} onChange={e => setNewReceivable({...newReceivable, amount: e.target.value})} placeholder="Valor" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none font-mono" required />
                    <input type="date" aria-label="Vencimento" value={newReceivable.dueDate} onChange={e => setNewReceivable({...newReceivable, dueDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" aria-label="Data de emissao" value={newReceivable.issueDate} onChange={e => setNewReceivable({...newReceivable, issueDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                    <input type="date" aria-label="Data de recebimento" value={newReceivable.receivedDate} onChange={e => setNewReceivable({...newReceivable, receivedDate: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  </div>
                  <select value={newReceivable.status} onChange={e => setNewReceivable({...newReceivable, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                    <option value="open">Em aberto</option>
                    <option value="received">Recebido</option>
                    <option value="overdue">Atrasado</option>
                  </select>
                  <textarea value={newReceivable.observation} onChange={e => setNewReceivable({...newReceivable, observation: e.target.value})} placeholder="Observação" className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-5 py-4 h-24 resize-y outline-none" />
                  <button className="w-full bg-white text-zinc-950 py-4 rounded-3xl font-semibold">{editingReceivable ? 'ATUALIZAR' : 'ADICIONAR'}</button>
                </form>

                <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex justify-between gap-5">
                    <div>
                      <div className="font-semibold">Recebimentos</div>
                      <div className="text-xs text-zinc-500">{filteredReceivables.length} registros encontrados</div>
                    </div>
                    <input value={receivableSearch} onChange={e => setReceivableSearch(e.target.value)} placeholder="Pesquisar" className="bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-3 outline-none text-sm w-full sm:w-80" />
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {filteredReceivables.map(receivable => (
                      <div key={receivable.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                        <div>
                          <div className="font-medium text-white">{receivable.description}</div>
                          <div className="text-xs text-zinc-500 mt-1">{receivable.clientName || 'Cliente não informado'} • {format(parseLocalDate(receivable.dueDate), 'dd/MM/yyyy')}</div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <span className="font-mono text-white">{formatCurrency(receivable.amount)}</span>
                          <span className={`px-3 py-1 rounded-3xl text-xs ${getPaymentStatusColor(receivable.status === 'received' ? 'paid' : receivable.status)}`}>{receivable.status === 'received' ? 'Recebido' : getPaymentStatusLabel(receivable.status)}</span>
                          <button onClick={() => markReceivableReceived(receivable)} className={`px-3 py-2 border rounded-xl text-xs ${receivable.status === 'received' ? 'border-zinc-600 text-zinc-400 hover:bg-zinc-800' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}>
                            {receivable.status === 'received' ? 'DESMARCAR' : 'RECEBIDO'}
                          </button>
                          <button onClick={() => editReceivable(receivable)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteRecord('/api/receivables', receivable.id, 'esta conta a receber', () => { setEditingReceivable(null); setNewReceivable(emptyReceivableForm); })} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    {filteredReceivables.length === 0 && <EmptyState title="Nenhuma conta a receber encontrada." actionLabel="Adicionar recebimento" onAction={() => openCreateForm('receivable')} />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Notas Fiscais</h2>
                <p className="text-zinc-400">Cadastre e pesquise notas fiscais sem obrigar número ou data.</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <form onSubmit={handleSaveInvoice} className={`${dataFormFloatingCardClass('invoice')} space-y-5`}>
                  <div className="mb-8 flex items-start justify-between gap-5">
                    <div>
                      <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('invoice')}</h3>
                    </div>
                    <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                  </div>
                  <input value={newInvoice.clientName} onChange={e => setNewInvoice({...newInvoice, clientName: e.target.value})} placeholder="Cliente opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <input value={newInvoice.number} onChange={e => setNewInvoice({...newInvoice, number: e.target.value})} placeholder="Número opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <select value={newInvoice.propertyId} onChange={e => setNewInvoice({...newInvoice, propertyId: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"><option value="">Sem imóvel</option>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
                  <select value={newInvoice.supplierId} onChange={e => setNewInvoice({...newInvoice, supplierId: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"><option value="">Sem fornecedor</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.tradeName || supplier.legalName}</option>)}</select>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={newInvoice.type} onChange={e => setNewInvoice({...newInvoice, type: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                      <option value="payable">Compra / pagamento</option>
                      <option value="receivable">Recebimento</option>
                    </select>
                    <select value={newInvoice.status} onChange={e => setNewInvoice({...newInvoice, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                      <option value="open">Em aberto</option>
                      <option value="paid">Pago</option>
                      <option value="overdue">Atrasado</option>
                      <option value="canceled">Cancelado</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" value={newInvoice.issueDate} onChange={e => setNewInvoice({...newInvoice, issueDate: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                    <input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice({...newInvoice, dueDate: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  </div>
                  <input type="number" step="0.01" value={newInvoice.amount} onChange={e => setNewInvoice({...newInvoice, amount: e.target.value})} placeholder="Valor" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none font-mono" />
                  <textarea value={newInvoice.description} onChange={e => setNewInvoice({...newInvoice, description: e.target.value})} placeholder="Descrição" className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-5 py-4 h-24 resize-y outline-none" />
                  <button className="w-full bg-white text-zinc-950 py-4 rounded-3xl font-semibold">{editingInvoice ? 'ATUALIZAR' : 'ADICIONAR'}</button>
                </form>
                <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex justify-between gap-5">
                    <div><div className="font-semibold">Notas cadastradas</div><div className="text-xs text-zinc-500">{filteredInvoices.length} registros encontrados</div></div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <input ref={invoiceAttachmentInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" onChange={event => void handleInvoiceAttachmentUpload(event)} className="hidden" />
                      {([
                        ['all', 'Todos'],
                        ['open', 'Em aberto'],
                        ['paid', 'Pago'],
                        ['overdue', 'Atrasado'],
                        ['canceled', 'Cancelado'],
                      ] as const).map(([value, label]) => (
                        <button key={value} type="button" onClick={() => setInvoiceStatusFilter(value)} className={`filter-chip ${invoiceStatusFilter === value ? 'filter-chip-active' : ''}`}>
                          {label}
                        </button>
                      ))}
                      <button type="button" onClick={() => openCreateForm('invoice')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all"><Plus className="w-4 h-4" /> Adicionar</button>
                      <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Pesquisar" className="bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-3 outline-none text-sm w-full sm:w-80" />
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-800">{filteredInvoices.map(invoice => (
                    <div key={invoice.listId} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950">
                      <div><div className="font-medium text-white">{invoice.number || 'Sem número'}</div><div className="text-xs text-zinc-500 mt-1">{invoice.clientName || invoice.description || 'Sem descrição'}</div><div className="mt-2 flex flex-wrap gap-2"><span className={`px-3 py-1 rounded-3xl text-xs ${getPaymentStatusColor(invoice.status)}`}>{getPaymentStatusLabel(invoice.status)}</span><span className="px-3 py-1 rounded-3xl bg-zinc-800 text-xs text-zinc-300">{invoice.type === 'receivable' ? 'Recebimento' : 'Compra'}</span><span className="px-3 py-1 rounded-3xl bg-blue-500/10 text-xs text-blue-300 ring-1 ring-blue-400/20">{invoice.sourceLabel}</span></div></div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className="font-mono text-white">{formatCurrency(invoice.amount || 0)}</span>
                        <button type="button" onClick={() => selectInvoiceAttachment(invoice)} className="px-4 py-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-xs font-semibold text-blue-300 transition-colors">
                          {invoice.attachmentData ? 'Substituir' : 'Anexar'}
                        </button>
                        {invoice.attachmentData && (
                          <>
                            <button type="button" onClick={() => viewInvoiceAttachment(invoice)} className="px-4 py-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-xs font-semibold text-emerald-300 transition-colors">
                              Visualizar
                            </button>
                            <button type="button" onClick={() => downloadInvoiceAttachment(invoice)} className="px-4 py-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-xs font-semibold text-violet-300 transition-colors">
                              Baixar
                            </button>
                          </>
                        )}
                        <button onClick={() => { if (invoice.source === 'expense') { const expense = expenses.find(item => item.id === invoice.sourceId); if (expense) editExpense(expense); return; } if (invoice.source === 'payable') { const payable = payables.find(item => item.id === invoice.sourceId); if (payable) editPayable(payable); return; } editInvoice(invoice); }} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors" title={invoice.source === 'manual' ? 'Editar nota fiscal' : `Editar ${invoice.sourceLabel.toLowerCase()}`}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {invoice.source === 'manual' && <button onClick={() => deleteRecord('/api/invoices', invoice.id, 'esta nota fiscal', () => { setEditingInvoice(null); setNewInvoice(emptyInvoiceForm); })} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}{filteredInvoices.length === 0 && <EmptyState title="Nenhuma nota fiscal encontrada." actionLabel="Adicionar nota fiscal" onAction={() => openCreateForm('invoice')} />}</div>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEES TAB */}
          {activeTab === 'employees' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div><h2 className="text-3xl font-semibold tracking-tight">Funcionarios</h2><p className="text-zinc-400">Cadastro local de equipe e contatos.</p></div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <form onSubmit={handleSaveEmployee} className={`${dataFormFloatingCardClass('employee')} space-y-5`}>
                  <div className="mb-8 flex items-start justify-between gap-5">
                    <div>
                      <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('employee')}</h3>
                    </div>
                    <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                  </div>
                  <input value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="Nome" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                  <input value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} placeholder="Função" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <input value={newEmployee.phone} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} placeholder="Telefone" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <input type="email" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} placeholder="E-mail opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <input value={newEmployee.document} onChange={e => setNewEmployee({...newEmployee, document: e.target.value})} placeholder="Documento" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <select value={newEmployee.status} onChange={e => setNewEmployee({...newEmployee, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                  <textarea value={newEmployee.notes} onChange={e => setNewEmployee({...newEmployee, notes: e.target.value})} placeholder="Observações" className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-5 py-4 h-24 resize-y outline-none" />
                  <button className="w-full bg-white text-zinc-950 py-4 rounded-3xl font-semibold">{editingEmployee ? 'ATUALIZAR' : 'ADICIONAR'}</button>
                </form>
                <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex justify-between gap-5"><div><div className="font-semibold">Equipe</div><div className="text-xs text-zinc-500">{filteredEmployees.length} registros encontrados</div></div><div className="flex flex-wrap items-center justify-end gap-3">{([
                    ['all', 'Todos'],
                    ['active', 'Ativos'],
                    ['inactive', 'Inativos'],
                  ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setEmployeeStatusFilter(value)} className={`filter-chip ${employeeStatusFilter === value ? 'filter-chip-active' : ''}`}>{label}</button>)}<button type="button" onClick={() => openCreateForm('employee')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all"><Plus className="w-4 h-4" /> Adicionar</button><input value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Pesquisar" className="bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-3 outline-none text-sm w-full sm:w-80" /></div></div>
                  <div className="divide-y divide-zinc-800">{filteredEmployees.map(employee => <div key={employee.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950"><div><div className="font-medium text-white">{employee.name}</div><div className="text-xs text-zinc-500 mt-1">{employee.role || 'Função não informada'} • {employee.phone || employee.email || 'Sem contato'} • {employee.status === 'active' ? 'Ativo' : 'Inativo'}</div></div><div className="flex flex-wrap justify-end gap-3"><button onClick={() => editEmployee(employee)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button><button onClick={() => deleteRecord('/api/employees', employee.id, 'este funcionario', () => { setEditingEmployee(null); setNewEmployee(emptyEmployeeForm); })} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button></div></div>)}{filteredEmployees.length === 0 && <EmptyState title="Nenhum funcionario encontrado." actionLabel="Adicionar funcionario" onAction={() => openCreateForm('employee')} />}</div>
                </div>
              </div>
            </div>
          )}

          {/* BUDGETS TAB */}
          {activeTab === 'budgets' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div><h2 className="text-3xl font-semibold tracking-tight">Orcamentos</h2><p className="text-zinc-400">Orçamentos com cliente opcional, imóvel e pesquisa flexível.</p></div>
              <div className="flex flex-wrap gap-2">
                {([
                  ['all', 'Todos'],
                  ['draft', 'Rascunhos'],
                  ['sent', 'Enviados'],
                  ['approved', 'Aprovados'],
                  ['rejected', 'Rejeitados'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBudgetStatusFilter(value)}
                    className={`filter-chip ${budgetStatusFilter === value ? 'filter-chip-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <form onSubmit={handleSaveBudget} className={`${dataFormFloatingCardClass('budget')} space-y-5`}>
                  <div className="mb-8 flex items-start justify-between gap-5">
                    <div>
                      <div className="text-xs uppercase tracking-[2px] text-violet-400">Cadastro</div>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{dataFormTitle('budget')}</h3>
                    </div>
                    <button type="button" onClick={closeDataForm} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800">Fechar</button>
                  </div>
                  <input value={newBudget.clientName} onChange={e => setNewBudget({...newBudget, clientName: e.target.value})} placeholder="Cliente opcional" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <input
                    list="budget-property-options"
                    value={budgetPropertyInput}
                    onChange={e => {
                      const typedName = e.target.value.trim().toLowerCase();
                      const matchedProperty = properties.find(property => property.name.trim().toLowerCase() === typedName);
                      setBudgetPropertyInput(e.target.value);
                      setNewBudget({ ...newBudget, propertyId: matchedProperty ? matchedProperty.id.toString() : '' });
                    }}
                    placeholder="Digite ou selecione um imovel"
                    className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"
                  />
                  <datalist id="budget-property-options">
                    {properties.map(property => <option key={property.id} value={property.name} />)}
                  </datalist>
                  <input value={newBudget.title} onChange={e => setNewBudget({...newBudget, title: e.target.value})} placeholder="Título" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                  <input type="number" step="0.01" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} placeholder="Valor" className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none font-mono" required />
                  <input type="date" value={newBudget.validUntil} onChange={e => setNewBudget({...newBudget, validUntil: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" />
                  <select value={newBudget.status} onChange={e => setNewBudget({...newBudget, status: e.target.value})} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none"><option value="draft">Rascunho</option><option value="sent">Enviado</option><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option></select>
                  <textarea value={newBudget.description} onChange={e => setNewBudget({...newBudget, description: e.target.value})} placeholder="Descrição" className="bg-zinc-950 w-full border border-zinc-700 rounded-3xl px-5 py-4 h-24 resize-y outline-none" />
                  <button className="w-full bg-white text-zinc-950 py-4 rounded-3xl font-semibold">{editingBudget ? 'ATUALIZAR' : 'ADICIONAR'}</button>
                </form>
                <div className="xl:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-800 bg-zinc-950 flex justify-between gap-5"><div><div className="font-semibold">Orcamentos cadastrados</div><div className="text-xs text-zinc-500">{filteredBudgets.length} registros encontrados</div></div><div className="flex flex-wrap items-center justify-end gap-3"><button type="button" onClick={() => openCreateForm('budget')} className="flex items-center gap-2 bg-white text-zinc-950 px-5 py-3 rounded-3xl text-sm font-semibold hover:bg-zinc-100 transition-all"><Plus className="w-4 h-4" /> Adicionar</button><input value={budgetSearch} onChange={e => setBudgetSearch(e.target.value)} placeholder="Pesquisar" className="bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-3 outline-none text-sm w-full sm:w-80" /></div></div>
                  <div className="divide-y divide-zinc-800">{filteredBudgets.map(budget => <div key={budget.id} className="floating-row p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-zinc-950"><div><div className="font-medium text-white">{budget.title}</div><div className="text-xs text-zinc-500 mt-1">{budget.clientName || 'Cliente não informado'} • {budget.status}</div></div><div className="flex flex-wrap items-center justify-end gap-3"><span className="font-mono text-white">{formatCurrency(budget.amount)}</span><button onClick={() => editBudget(budget)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button><button onClick={() => deleteRecord('/api/budgets', budget.id, 'este orcamento', () => { setEditingBudget(null); setNewBudget(emptyBudgetForm); })} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button></div></div>)}{filteredBudgets.length === 0 && <EmptyState title="Nenhum orcamento encontrado." actionLabel="Adicionar orcamento" onAction={() => openCreateForm('budget')} />}</div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && canAccessUsersArea() && (
            <div className="max-w-7xl mx-auto">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Usuarios e Permissoes</h2>
                  <p className="text-zinc-400">{canAccess('users') ? 'Controle quem acessa o Danix, o que pode visualizar e quais dados ficam isolados.' : 'Gere codigos de recuperacao para usuarios sem acessar os dados financeiros.'}</p>
                </div>
              </div>

              {lastRecoveryCode && (
                <div data-testid="recovery-code-alert" className={`recovery-code-alert mb-8 rounded-3xl border p-6 shadow-sm ${appTheme === 'light-blue' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
                  <div className="text-xs font-semibold uppercase tracking-[1.8px]">Codigo de recuperacao gerado</div>
                  <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3 font-mono text-lg font-semibold tracking-[1px] text-amber-950 ring-1 ring-amber-200">{lastRecoveryCode}</div>
                </div>
              )}

              <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[2px] text-violet-400">Minha senha</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">Alterar senha do usuario logado</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                      Apos alterar a senha, as sessoes sao encerradas e sera necessario entrar novamente.
                    </p>
                  </div>
                  <form onSubmit={handleChangeOwnPassword} className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-4">
                    <input type="password" value={passwordForm.currentPassword} onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} placeholder="Senha atual" className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 outline-none md:col-span-1" required />
                    <input type="password" value={passwordForm.newPassword} onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} placeholder="Nova senha" className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 outline-none md:col-span-1" required />
                    <input type="password" value={passwordForm.confirmPassword} onChange={event => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} placeholder="Confirmar" className="bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-3 outline-none md:col-span-1" required />
                    <button type="submit" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100">
                      Alterar
                    </button>
                  </form>
                </div>
              </div>

              {canAccess('users') && currentUser?.role === 'admin' && (
                <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[2px] text-violet-400">Backup local</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">Exportar ou importar banco de dados</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                        O backup completo inclui usuarios, permissoes e todos os dados locais. A importacao substitui o banco atual e exige novo login.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={backupBusy}
                        onClick={() => void exportManualBackup()}
                        className="flex items-center gap-2 rounded-3xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-100 disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" /> Exportar backup
                      </button>
                      <button
                        type="button"
                        disabled={backupBusy}
                        onClick={() => backupInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-3xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <Upload className="h-4 w-4" /> Importar backup
                      </button>
                      <input ref={backupInputRef} type="file" accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/octet-stream" onChange={event => void importManualBackup(event)} className="hidden" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {canAccess('users') && <div className="xl:col-span-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                  <div className="uppercase text-xs tracking-[2px] text-violet-400 mb-5 font-medium">
                    {editingUser ? 'EDITAR USUARIO' : 'NOVO USUARIO'}
                  </div>
                  <form onSubmit={handleSaveUser} className="space-y-5">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">USUARIO</label>
                      <input value={newUser.username} onChange={event => setNewUser({ ...newUser, username: event.target.value })} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">NOME</label>
                      <input value={newUser.displayName} onChange={event => setNewUser({ ...newUser, displayName: event.target.value })} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">{editingUser ? 'NOVA SENHA OPCIONAL' : 'SENHA'}</label>
                      <input type="password" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none" required={!editingUser} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-400 block mb-2">TIPO</label>
                        <select value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value })} className="bg-zinc-950 w-full border border-zinc-700 rounded-2xl px-5 py-4 outline-none">
                          <option value="user">Usuario</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-3 mt-7 text-sm text-zinc-300">
                        <input type="checkbox" checked={newUser.isActive} onChange={event => setNewUser({ ...newUser, isActive: event.target.checked })} />
                        Ativo
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {PERMISSION_ORDER.map(permission => (
                        <label key={permission} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                          <span>{permissionLabels[permission] || permission}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(newUser.permissions[permission]) || newUser.role === 'admin'}
                            disabled={newUser.role === 'admin'}
                            onChange={event => setNewUser({
                              ...newUser,
                              permissions: { ...newUser.permissions, [permission]: event.target.checked },
                            })}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="w-full bg-white text-zinc-950 py-4 font-semibold rounded-3xl hover:bg-zinc-100 transition-all">
                      {editingUser ? 'ATUALIZAR USUARIO' : 'CRIAR USUARIO'}
                    </button>
                    {editingUser && (
                      <button type="button" onClick={() => { setEditingUser(null); setNewUser(emptyUserForm); }} className="w-full border border-zinc-700 py-4 rounded-3xl text-sm hover:bg-zinc-800 transition-all">
                        CANCELAR
                      </button>
                    )}
                  </form>
                </div>}

                <div className={`${canAccess('users') ? 'xl:col-span-2' : 'xl:col-span-3'} bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden`}>
                  <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
                    <div className="font-semibold">Usuarios cadastrados</div>
                    <div className="text-xs text-zinc-500">{appUsers.length} usuario(s)</div>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {appUsers.map(user => (
                      <div key={user.id} className="px-8 py-6 flex items-center justify-between gap-6">
                        <div>
                          <div className="font-semibold text-white">{user.displayName}</div>
                          <div className="text-sm text-zinc-500">{user.username} - {user.role === 'admin' ? 'Administrador' : 'Usuario'} - {user.isActive ? 'Ativo' : 'Inativo'}</div>
                        </div>
                        <div className="flex gap-2">
                          {(canAccess('users') || canAccess('recoverUsers')) && (
                            <button onClick={() => void generateUserRecoveryCode(user.id)} className="px-4 py-2 hover:bg-zinc-800 rounded-xl text-xs text-emerald-300">Gerar codigo</button>
                          )}
                          {canAccess('users') && <button onClick={() => editUser(user)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>}
                          {canAccess('users') && <button disabled={user.id === currentUser.id} onClick={() => void deleteUser(user.id)} className="p-3 border border-zinc-800 hover:bg-zinc-800 rounded-2xl text-red-400 transition-colors disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </div>
                    ))}
                    {appUsers.length === 0 && <div className="py-16 text-center text-zinc-500">Nenhum usuario cadastrado.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COST ANALYSIS TAB */}
          {activeTab === 'analysis' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">Análise de Custo</h2>
                  <p className="text-zinc-400">Participacao de cada despesa, produto ou servico sobre o total de gastos filtrado</p>
                </div>
                <div className="flex items-end gap-4">
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">TOTAL DE GASTOS</div>
                    <div className="text-5xl font-semibold text-white tracking-tighter">{formatCurrency(totalFilteredCosts)}</div>
                  </div>
                  <div className={`${!canAccess('export') ? 'hidden ' : ''}flex gap-2 pb-1`}>
                    <button onClick={exportReportToPdf} className="border border-zinc-700 hover:bg-zinc-800 px-4 py-3 rounded-3xl text-xs font-medium transition-all">PDF</button>
                    <button onClick={() => setCustomPdfOpen(true)} className="custom-pdf-button border px-4 py-3 rounded-3xl text-xs font-semibold transition-all">PDF PERSONALIZADO</button>
                    <select
                      value={excelExportFormat}
                      onChange={event => setExcelExportFormat(event.target.value as 'xlsx' | 'xml')}
                      className="bg-zinc-950 border border-zinc-700 rounded-3xl px-3 py-3 text-xs outline-none"
                      aria-label="Formato do Excel"
                    >
                      <option value="xlsx">XLSX</option>
                      <option value="xml">XML</option>
                    </select>
                    <button onClick={exportReportToExcel} className="bg-white text-zinc-950 hover:bg-zinc-100 px-4 py-3 rounded-3xl text-xs font-semibold transition-all">EXCEL</button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                <div className="px-10 py-6 border-b border-zinc-800 bg-zinc-950 flex justify-between">
                  <div className="font-semibold">CUSTOS POR DESPESA / PRODUTO / SERVICO</div>
                  <div className="text-xs text-zinc-500">{filteredCostAnalysis.length} itens agrupados</div>
                </div>
                <div className="divide-y divide-zinc-800">
                  {filteredCostAnalysis.map(item => (
                    <div key={item.label} className="px-10 py-7">
                      <div className="flex items-start justify-between gap-8">
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-semibold text-white truncate">{item.label}</div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {item.count} lançamento(s) • {item.suppliers} • última compra em {format(parseLocalDate(item.lastPurchaseDate), 'dd/MM/yyyy')}
                          </div>
                          <div className="mt-5 h-3 bg-zinc-800 rounded-3xl overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-violet-400 rounded-3xl" style={{ width: `${Math.max(4, item.percentage)}%` }} />
                          </div>
                        </div>
                        <div className="text-right w-48">
                          <div className="font-mono text-xl text-white">{formatCurrency(item.total)}</div>
                          <div className="text-emerald-400 text-sm mt-1">{item.percentage.toFixed(1)}% do total</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredCostAnalysis.length === 0 && <EmptyState title="Registre despesas ou contas a pagar para gerar a analise." />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

