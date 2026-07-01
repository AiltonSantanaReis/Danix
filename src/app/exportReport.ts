import { format } from 'date-fns';

export interface ExportSupplier {
  id: number;
  propertyId?: number;
  legalName: string;
  tradeName?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  category: string;
  status: string;
}

export interface ExportPayable {
  id: number;
  propertyId?: number;
  supplierId?: number;
  supplierName?: string;
  product?: string;
  services?: string;
  purchaseDate: string;
  amount: string;
  invoiceNumber?: string;
  dueDate: string;
  status: string;
}

export interface ExportInvoice {
  id: number;
  propertyId?: number;
  supplierId?: number;
  clientName?: string;
  number?: string;
  issueDate?: string;
  dueDate?: string;
  amount?: string;
  status: string;
  type: string;
  description?: string;
}

export interface ExportEmployee {
  id: number;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  document?: string;
  status: string;
  notes?: string;
}

export interface ExportReceivable {
  id: number;
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

export interface ExportBudget {
  id: number;
  propertyId?: number;
  clientName?: string;
  title: string;
  description?: string;
  amount: string;
  validUntil?: string;
  status: string;
  observation?: string;
}

export interface ExportCostItem {
  label: string;
  total: number;
  count: number;
  suppliers: string;
  lastPurchaseDate: string;
  percentage: number;
}

export interface ExportProperty {
  id: number;
  name: string;
}

interface ReportOptions {
  properties?: ExportProperty[];
  suppliers: ExportSupplier[];
  payables: ExportPayable[];
  invoices?: ExportInvoice[];
  employees?: ExportEmployee[];
  receivables?: ExportReceivable[];
  budgets?: ExportBudget[];
  costAnalysis: ExportCostItem[];
  getPayableSupplierName: (payable: ExportPayable) => string;
  getPaymentStatusLabel: (status: string) => string;
  formatCurrency: (value: number | string) => string;
  parseLocalDate: (date: string) => Date;
  exportLogoData?: string | null;
}

export interface CustomPdfItem {
  description: string;
  quantity?: string;
  unitValue?: string;
  total?: string;
}

export interface CustomPdfOptions {
  documentTitle: string;
  clientName?: string;
  reference?: string;
  propertyName?: string;
  documentDate?: string;
  validUntil?: string;
  introduction?: string;
  items: CustomPdfItem[];
  paymentTerms?: string;
  notes?: string;
  signerLeft?: string;
  signerRight?: string;
  signerThird?: string;
  exportLogoData?: string | null;
  generatedAt: string;
}

const escapeHtml = (value: string | number | undefined | null) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const escapeXml = escapeHtml;

const getPropertyName = (properties: ExportProperty[] | undefined, propertyId?: number) => {
  if (!propertyId) return '';
  return properties?.find(property => property.id === propertyId)?.name || '';
};

const preserveLines = (value?: string) => escapeHtml(value || '').replaceAll('\n', '<br />');

const worksheet = (name: string, tableHtml: string) => `
  <div class="worksheet">
    <h2>${escapeHtml(name)}</h2>
    ${tableHtml}
  </div>
`;

export const buildExportReportHtml = ({
  properties,
  suppliers,
  payables,
  invoices = [],
  employees = [],
  receivables = [],
  budgets = [],
  costAnalysis,
  getPayableSupplierName,
  getPaymentStatusLabel,
  formatCurrency,
  parseLocalDate,
  exportLogoData,
}: ReportOptions) => {
  const formatDate = (date?: string) => date ? format(parseLocalDate(date), 'dd/MM/yyyy') : '';
  const totalCost = costAnalysis.reduce((sum, item) => sum + item.total, 0);
  const totalReceivable = receivables.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm');

  const payableRows = [...payables]
    .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime())
    .map(payable => `
      <tr>
        <td>${escapeHtml(getPayableSupplierName(payable))}</td>
        <td>${escapeHtml(getPropertyName(properties, payable.propertyId))}</td>
        <td>${escapeHtml(payable.product || '')}</td>
        <td>${escapeHtml(payable.services || '')}</td>
        <td>${escapeHtml(formatDate(payable.purchaseDate))}</td>
        <td>${escapeHtml(payable.invoiceNumber || '')}</td>
        <td>${escapeHtml(formatDate(payable.dueDate))}</td>
        <td>${escapeHtml(getPaymentStatusLabel(payable.status))}</td>
        <td class="money">${escapeHtml(formatCurrency(payable.amount))}</td>
      </tr>
    `).join('');

  const supplierRows = suppliers.map(supplier => `
    <tr>
      <td>${escapeHtml(supplier.legalName)}</td>
      <td>${escapeHtml(getPropertyName(properties, supplier.propertyId))}</td>
      <td>${escapeHtml(supplier.tradeName || '')}</td>
      <td>${escapeHtml(supplier.cnpj || '')}</td>
      <td>${escapeHtml(supplier.phone || '')}</td>
      <td>${escapeHtml(supplier.email || '')}</td>
      <td>${escapeHtml(supplier.category)}</td>
      <td>${escapeHtml(getPaymentStatusLabel(supplier.status))}</td>
    </tr>
  `).join('');

  const analysisRows = costAnalysis.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      <td>${escapeHtml(item.suppliers)}</td>
      <td>${escapeHtml(item.count)}</td>
      <td>${escapeHtml(formatDate(item.lastPurchaseDate))}</td>
      <td class="money">${escapeHtml(formatCurrency(item.total))}</td>
      <td>${escapeHtml(item.percentage.toFixed(1))}%</td>
    </tr>
  `).join('');

  const invoiceRows = invoices.map(invoice => `
    <tr>
      <td>${escapeHtml(invoice.number || '')}</td>
      <td>${escapeHtml(getPropertyName(properties, invoice.propertyId))}</td>
      <td>${escapeHtml(invoice.clientName || '')}</td>
      <td>${escapeHtml(invoice.type)}</td>
      <td>${escapeHtml(formatDate(invoice.issueDate))}</td>
      <td>${escapeHtml(formatDate(invoice.dueDate))}</td>
      <td>${escapeHtml(getPaymentStatusLabel(invoice.status))}</td>
      <td class="money">${escapeHtml(invoice.amount ? formatCurrency(invoice.amount) : '')}</td>
    </tr>
  `).join('');

  const employeeRows = employees.map(employee => `
    <tr>
      <td>${escapeHtml(employee.name)}</td>
      <td>${escapeHtml(employee.role || '')}</td>
      <td>${escapeHtml(employee.phone || '')}</td>
      <td>${escapeHtml(employee.email || '')}</td>
      <td>${escapeHtml(employee.document || '')}</td>
      <td>${escapeHtml(employee.status)}</td>
      <td>${escapeHtml(employee.notes || '')}</td>
    </tr>
  `).join('');

  const receivableRows = [...receivables]
    .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime())
    .map(receivable => `
      <tr>
        <td>${escapeHtml(receivable.clientName || '')}</td>
        <td>${escapeHtml(getPropertyName(properties, receivable.propertyId))}</td>
        <td>${escapeHtml(receivable.description)}</td>
        <td>${escapeHtml(formatDate(receivable.issueDate))}</td>
        <td>${escapeHtml(formatDate(receivable.dueDate))}</td>
        <td>${escapeHtml(formatDate(receivable.receivedDate))}</td>
        <td>${escapeHtml(getPaymentStatusLabel(receivable.status))}</td>
        <td>${escapeHtml(receivable.paymentMethod || '')}</td>
        <td class="money">${escapeHtml(formatCurrency(receivable.amount))}</td>
      </tr>
    `).join('');

  const budgetRows = budgets.map(budget => `
    <tr>
      <td>${escapeHtml(budget.title)}</td>
      <td>${escapeHtml(getPropertyName(properties, budget.propertyId))}</td>
      <td>${escapeHtml(budget.clientName || '')}</td>
      <td>${escapeHtml(formatDate(budget.validUntil))}</td>
      <td>${escapeHtml(budget.status)}</td>
      <td class="money">${escapeHtml(formatCurrency(budget.amount))}</td>
      <td>${escapeHtml(budget.observation || budget.description || '')}</td>
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Danix - Relatorio Financeiro</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #09090b; color: #e4e4e7; font-family: Arial, Helvetica, sans-serif; }
          .page { padding: 36px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #27272a; padding-bottom: 24px; margin-bottom: 26px; }
          .brandline { display: flex; align-items: center; gap: 14px; }
          .logo { width: 76px; max-height: 76px; object-fit: contain; }
          .brand { font-size: 30px; font-weight: 700; color: #fff; }
          .subtitle { color: #a1a1aa; margin-top: 6px; font-size: 13px; }
          .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0; }
          .tab { background: #27272a; border: 1px solid #3f3f46; color: #f4f4f5; padding: 9px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 18px; padding: 20px; }
          .label { color: #71717a; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
          .value { color: #fff; font-size: 25px; font-weight: 700; margin-top: 8px; }
          h2 { color: #fff; margin: 28px 0 12px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; background: #18181b; border: 1px solid #27272a; border-radius: 14px; overflow: hidden; margin-bottom: 22px; }
          th { background: #09090b; color: #a1a1aa; font-size: 11px; text-align: left; padding: 12px; border-bottom: 1px solid #27272a; }
          td { padding: 12px; border-bottom: 1px solid #27272a; font-size: 12px; color: #e4e4e7; }
          .money { text-align: right; font-family: Consolas, monospace; color: #86efac; white-space: nowrap; }
          @media print {
            body { background: #fff; color: #111827; }
            .page { padding: 18px; }
            .card, table { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <div class="brandline">
                ${exportLogoData ? `<img class="logo" src="${escapeHtml(exportLogoData)}" alt="Logo" />` : ''}
                <div class="brand">Danix</div>
              </div>
              <div class="subtitle">Relatorio financeiro local com dados filtrados do usuario logado</div>
            </div>
            <div class="subtitle">Gerado em ${escapeHtml(generatedAt)}</div>
          </div>
          <div class="tabs">
            <div class="tab">Fornecedores</div>
            <div class="tab">Contas a Pagar</div>
            <div class="tab">Notas Fiscais</div>
            <div class="tab">Funcionarios</div>
            <div class="tab">Contas a Receber</div>
            <div class="tab">Orcamentos</div>
            <div class="tab">Analise de Custo</div>
          </div>
          <div class="summary">
            <div class="card"><div class="label">Fornecedores</div><div class="value">${suppliers.length}</div></div>
            <div class="card"><div class="label">Contas filtradas</div><div class="value">${payables.length}</div></div>
            <div class="card"><div class="label">Total de gastos</div><div class="value">${escapeHtml(formatCurrency(totalCost))}</div></div>
            <div class="card"><div class="label">Total a receber</div><div class="value">${escapeHtml(formatCurrency(totalReceivable))}</div></div>
          </div>
          ${worksheet('Fornecedores', `
            <table>
              <thead><tr><th>Razao Social</th><th>Imovel relacionado</th><th>Nome Fantasia</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Categoria</th><th>Status</th></tr></thead>
              <tbody>${supplierRows || '<tr><td colspan="8">Nenhum fornecedor cadastrado.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Contas a Pagar', `
            <table>
              <thead><tr><th>Fornecedor</th><th>Imovel relacionado</th><th>Produto</th><th>Servico</th><th>Compra</th><th>NF/REC</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>${payableRows || '<tr><td colspan="9">Nenhuma conta encontrada.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Notas Fiscais', `
            <table>
              <thead><tr><th>Numero</th><th>Imovel relacionado</th><th>Cliente</th><th>Tipo</th><th>Emissao</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>${invoiceRows || '<tr><td colspan="8">Nenhuma nota fiscal encontrada.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Funcionarios', `
            <table>
              <thead><tr><th>Nome</th><th>Funcao</th><th>Telefone</th><th>E-mail</th><th>Documento</th><th>Status</th><th>Notas</th></tr></thead>
              <tbody>${employeeRows || '<tr><td colspan="7">Nenhum funcionario encontrado.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Contas a Receber', `
            <table>
              <thead><tr><th>Cliente</th><th>Imovel relacionado</th><th>Descricao</th><th>Emissao</th><th>Vencimento</th><th>Recebimento</th><th>Status</th><th>Forma</th><th>Valor</th></tr></thead>
              <tbody>${receivableRows || '<tr><td colspan="9">Nenhuma conta a receber encontrada.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Orcamentos', `
            <table>
              <thead><tr><th>Titulo</th><th>Imovel relacionado</th><th>Cliente</th><th>Validade</th><th>Status</th><th>Valor</th><th>Observacao</th></tr></thead>
              <tbody>${budgetRows || '<tr><td colspan="7">Nenhum orcamento encontrado.</td></tr>'}</tbody>
            </table>
          `)}
          ${worksheet('Analise de Custo', `
            <table>
              <thead><tr><th>Despesa / Produto / Servico</th><th>Origem</th><th>Lancamentos</th><th>Ultima compra</th><th>Total</th><th>% do total</th></tr></thead>
              <tbody>${analysisRows || '<tr><td colspan="6">Sem dados para analise.</td></tr>'}</tbody>
            </table>
          `)}
        </div>
      </body>
    </html>
  `;
};

export const buildCustomPdfHtml = ({
  documentTitle,
  clientName,
  reference,
  propertyName,
  documentDate,
  validUntil,
  introduction,
  items,
  paymentTerms,
  notes,
  signerLeft,
  signerRight,
  signerThird,
  exportLogoData,
  generatedAt,
}: CustomPdfOptions) => {
  const itemRows = items.length > 0
    ? items.map(item => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="center">${escapeHtml(item.quantity || '')}</td>
        <td class="money">${escapeHtml(item.unitValue || '')}</td>
        <td class="money">${escapeHtml(item.total || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4">Inclua os itens, etapas ou servicos desejados antes de exportar.</td></tr>';

  const signatures = [signerLeft, signerRight, signerThird].filter(Boolean);

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(documentTitle || 'Documento personalizado')} - Danix</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f4f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
          .page { max-width: 920px; margin: 0 auto; padding: 42px; background: #fff; min-height: 100vh; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 24px; margin-bottom: 30px; }
          .brand { display: flex; align-items: center; gap: 16px; min-width: 0; }
          .logo { width: 92px; max-height: 72px; object-fit: contain; }
          .brand-name { font-size: 28px; font-weight: 800; letter-spacing: .01em; }
          .tagline { color: #4b5563; font-size: 12px; margin-top: 4px; }
          .meta { text-align: right; color: #4b5563; font-size: 12px; line-height: 1.7; }
          h1 { margin: 0 0 8px; font-size: 30px; color: #111827; }
          .subtitle { color: #4b5563; line-height: 1.6; margin-bottom: 24px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 0 28px; }
          .info { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px 16px; }
          .label { text-transform: uppercase; letter-spacing: .08em; color: #6b7280; font-size: 10px; font-weight: 700; }
          .value { margin-top: 5px; font-size: 14px; color: #111827; min-height: 18px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0 28px; border: 1px solid #d1d5db; }
          th { background: #111827; color: #fff; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
          td { padding: 12px; border-top: 1px solid #e5e7eb; vertical-align: top; font-size: 13px; line-height: 1.45; }
          .center { text-align: center; }
          .money { text-align: right; font-family: Consolas, monospace; white-space: nowrap; }
          .section { margin-top: 24px; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; color: #111827; }
          .box { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; color: #374151; line-height: 1.65; min-height: 68px; }
          .signatures { display: grid; grid-template-columns: repeat(${Math.max(signatures.length, 1)}, 1fr); gap: 22px; margin-top: 58px; }
          .signature { text-align: center; color: #111827; font-size: 13px; }
          .line { border-top: 1px solid #111827; margin-bottom: 10px; height: 1px; }
          .footer { margin-top: 42px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; display: flex; justify-content: space-between; gap: 16px; }
          @media print {
            body { background: #fff; }
            .page { max-width: none; padding: 24px; }
            .box, table, .signatures { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="brand">
              ${exportLogoData ? `<img class="logo" src="${escapeHtml(exportLogoData)}" alt="Logo" />` : ''}
              <div>
                <div class="brand-name">Danix</div>
                <div class="tagline">Gestao - Controle - Resultados</div>
              </div>
            </div>
            <div class="meta">
              <div>Gerado em ${escapeHtml(generatedAt)}</div>
              ${documentDate ? `<div>Data do documento: ${escapeHtml(documentDate)}</div>` : ''}
              ${validUntil ? `<div>Validade: ${escapeHtml(validUntil)}</div>` : ''}
            </div>
          </div>

          <h1>${escapeHtml(documentTitle || 'Documento personalizado')}</h1>
          ${introduction ? `<div class="subtitle">${preserveLines(introduction)}</div>` : ''}

          <div class="info-grid">
            <div class="info"><div class="label">Cliente / Responsavel</div><div class="value">${escapeHtml(clientName || '')}</div></div>
            <div class="info"><div class="label">Referencia</div><div class="value">${escapeHtml(reference || '')}</div></div>
            <div class="info"><div class="label">Imovel relacionado</div><div class="value">${escapeHtml(propertyName || '')}</div></div>
            <div class="info"><div class="label">Documento</div><div class="value">${escapeHtml(documentTitle || '')}</div></div>
          </div>

          <div class="section">
            <div class="section-title">Itens / Servicos</div>
            <table>
              <thead>
                <tr><th>Descricao</th><th>Qtd.</th><th>Valor unitario</th><th>Total</th></tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Condicoes de pagamento</div>
            <div class="box">${preserveLines(paymentTerms)}</div>
          </div>

          <div class="section">
            <div class="section-title">Observacoes</div>
            <div class="box">${preserveLines(notes)}</div>
          </div>

          <div class="signatures">
            ${(signatures.length ? signatures : ['Assinatura']).map(label => `
              <div class="signature">
                <div class="line"></div>
                ${escapeHtml(label)}
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <span>Documento personalizado gerado localmente pelo Danix.</span>
            <span>Sem alteracao nos dados originais do relatorio financeiro.</span>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const buildExcelWorkbookXml = (options: ReportOptions) => {
  const {
    properties,
    suppliers,
    payables,
    invoices = [],
    employees = [],
    receivables = [],
    budgets = [],
    costAnalysis,
    getPayableSupplierName,
    getPaymentStatusLabel,
    formatCurrency,
    parseLocalDate,
  } = options;
  const formatDate = (date?: string) => date ? format(parseLocalDate(date), 'dd/MM/yyyy') : '';
  const cell = (value: string | number | undefined | null, style = 'Default') => (
    `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeHtml(value)}</Data></Cell>`
  );
  const moneyCell = (value: string | number) => cell(formatCurrency(value), 'Money');
  const row = (cells: string[]) => `<Row>${cells.join('')}</Row>`;
  const column = (width: number) => `<Column ss:Width="${width}"/>`;
  const table = (rows: string[], widths: number[]) => `<Table>${widths.map(column).join('')}${rows.join('')}</Table>`;
  const worksheetXml = (name: string, rows: string[], widths: number[]) => `
    <Worksheet ss:Name="${escapeHtml(name)}">
      ${table(rows, widths)}
    </Worksheet>
  `;

  const totalCost = costAnalysis.reduce((sum, item) => sum + item.total, 0);
  const totalReceivable = receivables.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const summaryRows = [
    row([cell('Danix', 'Title')]),
    row([cell('Relatorio financeiro local com dados filtrados do usuario logado')]),
    row([cell(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`)]),
    row([cell('Indicador', 'Header'), cell('Valor', 'Header')]),
    row([cell('Fornecedores'), cell(suppliers.length)]),
    row([cell('Contas filtradas'), cell(payables.length)]),
    row([cell('Total de gastos'), moneyCell(totalCost)]),
    row([cell('Total a receber'), moneyCell(totalReceivable)]),
  ];

  const supplierRows = [
    row(['Razao Social', 'Imovel relacionado', 'Nome Fantasia', 'CNPJ', 'Telefone', 'E-mail', 'Categoria', 'Status'].map(value => cell(value, 'Header'))),
    ...suppliers.map(supplier => row([
      cell(supplier.legalName),
      cell(getPropertyName(properties, supplier.propertyId)),
      cell(supplier.tradeName || ''),
      cell(supplier.cnpj || ''),
      cell(supplier.phone || ''),
      cell(supplier.email || ''),
      cell(supplier.category),
      cell(getPaymentStatusLabel(supplier.status)),
    ])),
  ];

  const payableRows = [
    row(['Fornecedor', 'Imovel relacionado', 'Produto', 'Servico', 'Compra', 'NF/REC', 'Vencimento', 'Status', 'Valor'].map(value => cell(value, 'Header'))),
    ...[...payables]
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime())
      .map(payable => row([
        cell(getPayableSupplierName(payable)),
        cell(getPropertyName(properties, payable.propertyId)),
        cell(payable.product || ''),
        cell(payable.services || ''),
        cell(formatDate(payable.purchaseDate)),
        cell(payable.invoiceNumber || ''),
        cell(formatDate(payable.dueDate)),
        cell(getPaymentStatusLabel(payable.status)),
        moneyCell(payable.amount),
      ])),
  ];

  const analysisRows = [
    row(['Despesa / Produto / Servico', 'Origem', 'Lancamentos', 'Ultima compra', 'Total', '% do total'].map(value => cell(value, 'Header'))),
    ...costAnalysis.map(item => row([
      cell(item.label),
      cell(item.suppliers),
      cell(item.count),
      cell(formatDate(item.lastPurchaseDate)),
      moneyCell(item.total),
      cell(`${item.percentage.toFixed(1)}%`),
    ])),
  ];

  const invoiceRows = [
    row(['Numero', 'Imovel relacionado', 'Cliente', 'Tipo', 'Emissao', 'Vencimento', 'Status', 'Valor'].map(value => cell(value, 'Header'))),
    ...invoices.map(invoice => row([
      cell(invoice.number || ''),
      cell(getPropertyName(properties, invoice.propertyId)),
      cell(invoice.clientName || ''),
      cell(invoice.type),
      cell(formatDate(invoice.issueDate)),
      cell(formatDate(invoice.dueDate)),
      cell(getPaymentStatusLabel(invoice.status)),
      invoice.amount ? moneyCell(invoice.amount) : cell(''),
    ])),
  ];

  const employeeRows = [
    row(['Nome', 'Funcao', 'Telefone', 'E-mail', 'Documento', 'Status', 'Notas'].map(value => cell(value, 'Header'))),
    ...employees.map(employee => row([
      cell(employee.name),
      cell(employee.role || ''),
      cell(employee.phone || ''),
      cell(employee.email || ''),
      cell(employee.document || ''),
      cell(employee.status),
      cell(employee.notes || ''),
    ])),
  ];

  const receivableRows = [
    row(['Cliente', 'Imovel relacionado', 'Descricao', 'Emissao', 'Vencimento', 'Recebimento', 'Status', 'Forma', 'Valor'].map(value => cell(value, 'Header'))),
    ...[...receivables]
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime())
      .map(receivable => row([
        cell(receivable.clientName || ''),
        cell(getPropertyName(properties, receivable.propertyId)),
        cell(receivable.description),
        cell(formatDate(receivable.issueDate)),
        cell(formatDate(receivable.dueDate)),
        cell(formatDate(receivable.receivedDate)),
        cell(getPaymentStatusLabel(receivable.status)),
        cell(receivable.paymentMethod || ''),
        moneyCell(receivable.amount),
      ])),
  ];

  const budgetRows = [
    row(['Titulo', 'Imovel relacionado', 'Cliente', 'Validade', 'Status', 'Valor', 'Observacao'].map(value => cell(value, 'Header'))),
    ...budgets.map(budget => row([
      cell(budget.title),
      cell(getPropertyName(properties, budget.propertyId)),
      cell(budget.clientName || ''),
      cell(formatDate(budget.validUntil)),
      cell(budget.status),
      moneyCell(budget.amount),
      cell(budget.observation || budget.description || ''),
    ])),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#111827"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#18181B" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Money">
      <Font ss:FontName="Consolas" ss:Size="10" ss:Color="#047857"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#111827"/>
    </Style>
  </Styles>
  ${worksheetXml('Resumo', summaryRows, [220, 160])}
  ${worksheetXml('Fornecedores', supplierRows, [220, 180, 180, 120, 130, 220, 150, 110])}
  ${worksheetXml('Contas a Pagar', payableRows, [190, 180, 180, 220, 110, 120, 120, 110, 120])}
  ${worksheetXml('Notas Fiscais', invoiceRows, [120, 180, 180, 100, 110, 110, 110, 120])}
  ${worksheetXml('Funcionarios', employeeRows, [220, 160, 130, 220, 130, 100, 260])}
  ${worksheetXml('Contas a Receber', receivableRows, [180, 180, 260, 110, 110, 110, 110, 130, 120])}
  ${worksheetXml('Orcamentos', budgetRows, [220, 180, 180, 110, 110, 120, 260])}
  ${worksheetXml('Analise de Custo', analysisRows, [220, 220, 110, 120, 120, 110])}
</Workbook>`;
};

type XlsxCellValue = string | number | undefined | null;

const columnName = (index: number) => {
  let name = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
};

const cellRef = (columnIndex: number, rowIndex: number) => `${columnName(columnIndex)}${rowIndex}`;

const xlsxTextCell = (columnIndex: number, rowIndex: number, value: XlsxCellValue, style = 1) => (
  `<c r="${cellRef(columnIndex, rowIndex)}" t="inlineStr" s="${style}"><is><t>${escapeXml(value)}</t></is></c>`
);

const xlsxNumberCell = (columnIndex: number, rowIndex: number, value: number, style = 2) => (
  `<c r="${cellRef(columnIndex, rowIndex)}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
);

const xlsxRow = (rowIndex: number, cells: string[], height?: number) => (
  `<row r="${rowIndex}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells.join('')}</row>`
);

const xlsxColumns = (widths: number[]) => (
  `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
);

const xlsxSheet = (name: string, widths: number[], rows: string[], autoFilterRef?: string) => ({
  name,
  xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  ${xlsxColumns(widths)}
  <sheetData>${rows.join('')}</sheetData>
  ${autoFilterRef ? `<autoFilter ref="${autoFilterRef}"/>` : ''}
</worksheet>`,
});

const crcTable = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let current = i;
    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    }
    table[i] = current >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
};

const createZip = (files: Array<{ path: string; content: string }>) => {
  const encoder = new TextEncoder();
  const encodedFiles = files.map(file => ({
    path: encoder.encode(file.path),
    content: encoder.encode(file.content),
    crc: 0,
    offset: 0,
  }));

  encodedFiles.forEach(file => {
    file.crc = crc32(file.content);
  });

  const localSize = encodedFiles.reduce((sum, file) => sum + 30 + file.path.length + file.content.length, 0);
  const centralSize = encodedFiles.reduce((sum, file) => sum + 46 + file.path.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  let offset = 0;

  encodedFiles.forEach(file => {
    file.offset = offset;
    writeUint32(output, offset, 0x04034b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 0);
    writeUint16(output, offset + 8, 0);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint32(output, offset + 14, file.crc);
    writeUint32(output, offset + 18, file.content.length);
    writeUint32(output, offset + 22, file.content.length);
    writeUint16(output, offset + 26, file.path.length);
    writeUint16(output, offset + 28, 0);
    output.set(file.path, offset + 30);
    output.set(file.content, offset + 30 + file.path.length);
    offset += 30 + file.path.length + file.content.length;
  });

  const centralOffset = offset;
  encodedFiles.forEach(file => {
    writeUint32(output, offset, 0x02014b50);
    writeUint16(output, offset + 4, 20);
    writeUint16(output, offset + 6, 20);
    writeUint16(output, offset + 8, 0);
    writeUint16(output, offset + 10, 0);
    writeUint16(output, offset + 12, 0);
    writeUint16(output, offset + 14, 0);
    writeUint32(output, offset + 16, file.crc);
    writeUint32(output, offset + 20, file.content.length);
    writeUint32(output, offset + 24, file.content.length);
    writeUint16(output, offset + 28, file.path.length);
    writeUint16(output, offset + 30, 0);
    writeUint16(output, offset + 32, 0);
    writeUint16(output, offset + 34, 0);
    writeUint16(output, offset + 36, 0);
    writeUint32(output, offset + 38, 0);
    writeUint32(output, offset + 42, file.offset);
    output.set(file.path, offset + 46);
    offset += 46 + file.path.length;
  });

  writeUint32(output, offset, 0x06054b50);
  writeUint16(output, offset + 4, 0);
  writeUint16(output, offset + 6, 0);
  writeUint16(output, offset + 8, encodedFiles.length);
  writeUint16(output, offset + 10, encodedFiles.length);
  writeUint32(output, offset + 12, centralSize);
  writeUint32(output, offset + 16, centralOffset);
  writeUint16(output, offset + 20, 0);

  return output;
};

export const buildExcelWorkbookXlsx = (options: ReportOptions) => {
  const {
    properties,
    suppliers,
    payables,
    invoices = [],
    employees = [],
    receivables = [],
    budgets = [],
    costAnalysis,
    getPayableSupplierName,
    getPaymentStatusLabel,
    parseLocalDate,
  } = options;
  const formatDate = (date?: string) => date ? format(parseLocalDate(date), 'dd/MM/yyyy') : '';
  const totalCost = payables.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const totalReceivable = receivables.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const sortedPayables = [...payables].sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  const sortedReceivables = [...receivables].sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());

  const summaryRows = [
    xlsxRow(1, [xlsxTextCell(1, 1, 'Danix', 3)], 24),
    xlsxRow(2, [xlsxTextCell(1, 2, 'Relatorio financeiro local com dados filtrados do usuario logado', 1)]),
    xlsxRow(3, [xlsxTextCell(1, 3, `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 1)]),
    xlsxRow(5, [xlsxTextCell(1, 5, 'Indicador', 4), xlsxTextCell(2, 5, 'Valor', 4)]),
    xlsxRow(6, [xlsxTextCell(1, 6, 'Fornecedores', 1), xlsxNumberCell(2, 6, suppliers.length, 5)]),
    xlsxRow(7, [xlsxTextCell(1, 7, 'Contas filtradas', 1), xlsxNumberCell(2, 7, payables.length, 5)]),
    xlsxRow(8, [xlsxTextCell(1, 8, 'Total de gastos', 1), xlsxNumberCell(2, 8, totalCost, 2)]),
    xlsxRow(9, [xlsxTextCell(1, 9, 'Total a receber', 1), xlsxNumberCell(2, 9, totalReceivable, 2)]),
  ];

  const supplierHeaders = ['Razao Social', 'Imovel relacionado', 'Nome Fantasia', 'CNPJ', 'Telefone', 'E-mail', 'Categoria', 'Status'];
  const supplierRows = [
    xlsxRow(1, supplierHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...suppliers.map((supplier, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, supplier.legalName),
        xlsxTextCell(2, rowIndex, getPropertyName(properties, supplier.propertyId)),
        xlsxTextCell(3, rowIndex, supplier.tradeName || ''),
        xlsxTextCell(4, rowIndex, supplier.cnpj || ''),
        xlsxTextCell(5, rowIndex, supplier.phone || ''),
        xlsxTextCell(6, rowIndex, supplier.email || ''),
        xlsxTextCell(7, rowIndex, supplier.category),
        xlsxTextCell(8, rowIndex, getPaymentStatusLabel(supplier.status), 6),
      ]);
    }),
  ];

  const payableHeaders = ['Fornecedor', 'Imovel relacionado', 'Produto', 'Servico', 'Compra', 'NF/REC', 'Vencimento', 'Status', 'Valor'];
  const payableRows = [
    xlsxRow(1, payableHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...sortedPayables.map((payable, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, getPayableSupplierName(payable)),
        xlsxTextCell(2, rowIndex, getPropertyName(properties, payable.propertyId)),
        xlsxTextCell(3, rowIndex, payable.product || ''),
        xlsxTextCell(4, rowIndex, payable.services || ''),
        xlsxTextCell(5, rowIndex, formatDate(payable.purchaseDate)),
        xlsxTextCell(6, rowIndex, payable.invoiceNumber || ''),
        xlsxTextCell(7, rowIndex, formatDate(payable.dueDate)),
        xlsxTextCell(8, rowIndex, getPaymentStatusLabel(payable.status), 6),
        xlsxNumberCell(9, rowIndex, parseFloat(payable.amount || '0'), 2),
      ]);
    }),
  ];

  const analysisHeaders = ['Produto / Servico', 'Fornecedores', 'Lancamentos', 'Ultima compra', 'Total', '% do total'];
  const analysisRows = [
    xlsxRow(1, analysisHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...costAnalysis.map((item, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, item.label),
        xlsxTextCell(2, rowIndex, item.suppliers),
        xlsxNumberCell(3, rowIndex, item.count, 5),
        xlsxTextCell(4, rowIndex, formatDate(item.lastPurchaseDate)),
        xlsxNumberCell(5, rowIndex, item.total, 2),
        xlsxNumberCell(6, rowIndex, item.percentage / 100, 7),
      ]);
    }),
  ];

  const invoiceHeaders = ['Numero', 'Imovel relacionado', 'Cliente', 'Tipo', 'Emissao', 'Vencimento', 'Status', 'Valor'];
  const invoiceRows = [
    xlsxRow(1, invoiceHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...invoices.map((invoice, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, invoice.number || ''),
        xlsxTextCell(2, rowIndex, getPropertyName(properties, invoice.propertyId)),
        xlsxTextCell(3, rowIndex, invoice.clientName || ''),
        xlsxTextCell(4, rowIndex, invoice.type),
        xlsxTextCell(5, rowIndex, formatDate(invoice.issueDate)),
        xlsxTextCell(6, rowIndex, formatDate(invoice.dueDate)),
        xlsxTextCell(7, rowIndex, getPaymentStatusLabel(invoice.status), 6),
        xlsxNumberCell(8, rowIndex, parseFloat(invoice.amount || '0'), 2),
      ]);
    }),
  ];

  const employeeHeaders = ['Nome', 'Funcao', 'Telefone', 'E-mail', 'Documento', 'Status', 'Notas'];
  const employeeRows = [
    xlsxRow(1, employeeHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...employees.map((employee, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, employee.name),
        xlsxTextCell(2, rowIndex, employee.role || ''),
        xlsxTextCell(3, rowIndex, employee.phone || ''),
        xlsxTextCell(4, rowIndex, employee.email || ''),
        xlsxTextCell(5, rowIndex, employee.document || ''),
        xlsxTextCell(6, rowIndex, employee.status),
        xlsxTextCell(7, rowIndex, employee.notes || ''),
      ]);
    }),
  ];

  const receivableHeaders = ['Cliente', 'Imovel relacionado', 'Descricao', 'Emissao', 'Vencimento', 'Recebimento', 'Status', 'Forma', 'Valor'];
  const receivableRows = [
    xlsxRow(1, receivableHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...sortedReceivables.map((receivable, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, receivable.clientName || ''),
        xlsxTextCell(2, rowIndex, getPropertyName(properties, receivable.propertyId)),
        xlsxTextCell(3, rowIndex, receivable.description),
        xlsxTextCell(4, rowIndex, formatDate(receivable.issueDate)),
        xlsxTextCell(5, rowIndex, formatDate(receivable.dueDate)),
        xlsxTextCell(6, rowIndex, formatDate(receivable.receivedDate)),
        xlsxTextCell(7, rowIndex, getPaymentStatusLabel(receivable.status), 6),
        xlsxTextCell(8, rowIndex, receivable.paymentMethod || ''),
        xlsxNumberCell(9, rowIndex, parseFloat(receivable.amount || '0'), 2),
      ]);
    }),
  ];

  const budgetHeaders = ['Titulo', 'Imovel relacionado', 'Cliente', 'Validade', 'Status', 'Valor', 'Observacao'];
  const budgetRows = [
    xlsxRow(1, budgetHeaders.map((header, index) => xlsxTextCell(index + 1, 1, header, 4))),
    ...budgets.map((budget, index) => {
      const rowIndex = index + 2;
      return xlsxRow(rowIndex, [
        xlsxTextCell(1, rowIndex, budget.title),
        xlsxTextCell(2, rowIndex, getPropertyName(properties, budget.propertyId)),
        xlsxTextCell(3, rowIndex, budget.clientName || ''),
        xlsxTextCell(4, rowIndex, formatDate(budget.validUntil)),
        xlsxTextCell(5, rowIndex, budget.status),
        xlsxNumberCell(6, rowIndex, parseFloat(budget.amount || '0'), 2),
        xlsxTextCell(7, rowIndex, budget.observation || budget.description || ''),
      ]);
    }),
  ];

  const sheets = [
    xlsxSheet('Resumo', [24, 20], summaryRows),
    xlsxSheet('Fornecedores', [32, 26, 28, 18, 18, 34, 22, 16], supplierRows, `A1:H${Math.max(2, suppliers.length + 1)}`),
    xlsxSheet('Contas a Pagar', [30, 26, 28, 34, 16, 18, 16, 16, 18], payableRows, `A1:I${Math.max(2, sortedPayables.length + 1)}`),
    xlsxSheet('Notas Fiscais', [18, 26, 28, 14, 16, 16, 16, 18], invoiceRows, `A1:H${Math.max(2, invoices.length + 1)}`),
    xlsxSheet('Funcionarios', [30, 24, 18, 34, 20, 16, 40], employeeRows, `A1:G${Math.max(2, employees.length + 1)}`),
    xlsxSheet('Contas a Receber', [28, 26, 40, 16, 16, 16, 16, 20, 18], receivableRows, `A1:I${Math.max(2, sortedReceivables.length + 1)}`),
    xlsxSheet('Orcamentos', [34, 26, 28, 16, 16, 18, 42], budgetRows, `A1:G${Math.max(2, budgets.length + 1)}`),
    xlsxSheet('Analise de Custo', [34, 34, 16, 18, 18, 16], analysisRows, `A1:F${Math.max(2, costAnalysis.length + 1)}`),
  ];

  const workbookSheets = sheets.map((sheet, index) => (
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('');

  const workbookRels = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');

  return createZip([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
  <fonts count="5">
    <font><sz val="10"/><color rgb="FF111827"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="18"/><color rgb="FF111827"/><name val="Arial"/></font>
    <font><sz val="10"/><color rgb="FF047857"/><name val="Consolas"/></font>
    <font><b/><sz val="10"/><color rgb="FF111827"/><name val="Arial"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF18181B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE4E4E7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD4D4D8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD4D4D8"/></left><right style="thin"><color rgb="FFD4D4D8"/></right><top style="thin"><color rgb="FFD4D4D8"/></top><bottom style="thin"><color rgb="FFD4D4D8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
    <xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheet.xml,
    })),
  ]);
};
