# Danix Desktop Offline

Offline-first desktop management system for real estate investment control, local financial operations, invoices, suppliers, reports, user access, backups, and Windows desktop delivery.

Danix combines a Next.js/React interface, internal API routes, local SQLite persistence, and Electron packaging to deliver a portable Windows application that runs without a remote database or external cloud dependency for its main data.

> Current status: validated local desktop build. The project is focused on local execution, usability, data persistence, business rules, and desktop packaging.

---

## Overview

Danix is a local-first desktop application created to help manage real estate investment operations from a single offline environment.

The system centralizes:

- Properties.
- Expenses.
- Sales.
- Suppliers.
- Payables.
- Invoices.
- Employees.
- Receivables.
- Budgets.
- Cost analysis.
- Local users and permissions.
- PDF/Excel exports.
- Manual SQLite backup and restore.

The application is designed for users who need a desktop system with local data ownership, simple workflows, and no dependence on a public SaaS backend.

---

## Why This Project Exists

Danix was created to demonstrate the delivery of a real desktop product using web technologies while still solving practical local software concerns:

- Offline local data persistence.
- Desktop packaging for Windows.
- Internal API architecture.
- User access control.
- Financial and operational workflows.
- Backup and restore.
- Visual validation through automated UI smoke tests.
- Portable distribution without requiring Node.js to be globally installed on the client machine.

This project shows not only interface development, but also the engineering work required to make a local desktop application usable and distributable.

---

## Tech Stack

| Area | Technology |
|---|---|
| Interface | React + Next.js |
| Desktop runtime | Electron |
| Local server | Next.js standalone server |
| Database | SQLite |
| Database access | Drizzle ORM + better-sqlite3 |
| Language | TypeScript / JavaScript |
| Packaging | electron-builder |
| Runtime distribution | Portable Node bundled inside the package |
| Reports | PDF / print flow + Excel export |
| Testing / validation | Typecheck, ESLint, API smoke tests, CRUD smoke tests, visual smoke tests |
| Platform | Windows desktop |

---

## Main Features

### Financial Dashboard

- Financial overview focused on paid, open and overdue amounts.
- Category-based spending visualization.
- Payable status chart.
- Monthly evolution view.
- Visual alert for open payables due within the next 7 days.
- Optional dashboard blocks controlled locally.

### Property Management

- Property registration and editing.
- Property list with inline expansion.
- Linked expenses, suppliers, payables, invoices, receivables and budgets.
- Business rules to avoid deleting records that still have linked data.

### Expenses and Sales

- Expense registration.
- Sales registration.
- Property status recalculation when sales are created, changed or deleted.
- Cost analysis using expenses and linked payables.

### Suppliers and Payables

- Supplier registration and editing.
- Optional supplier e-mail.
- Optional supplier and payable association with a property.
- Installment payables.
- Mark and unmark payables as paid while keeping the record visible.
- Query by supplier, product, service, invoice/receipt number, payment method, status and notes.

### Invoices and Attachments

- Invoice registration.
- Optional invoice number and invoice date.
- Invoice status control.
- Local attachments for PDF, JPEG, PNG and WebP files.
- Attachment viewing and download from local storage.
- Invoices can also be connected to expenses and payables.

### Receivables, Employees and Budgets

- Receivables with quick filters.
- Employee records with active/inactive status.
- Budgets with editable status.
- Free-text search across major operational tabs.

### Reports and Exports

- PDF/print report generation.
- Custom PDF flow with editable fields before printing.
- User-specific logo for PDF exports.
- Excel export in XLSX or XML format.
- Reports respect the filtered data loaded for the current user.

### Local Users and Security

- First user becomes administrator.
- Administrators have all permissions.
- Common users only access permitted screens.
- Data visibility can be restricted by user ownership.
- `viewAllData` permission allows authorized users to see all local data.
- User creation, editing and deactivation.
- Local password recovery code.
- Recovery code is invalidated after successful use.
- Protection against disabling or demoting the last active administrator.
- Password change invalidates previous sessions.
- Temporary local lockout after multiple failed login attempts.
- Administrative events are logged locally.

### Backup and Restore

- Manual full SQLite backup export.
- Manual SQLite backup import.
- Backup import validates SQLite integrity.
- Restore replaces local data and requires a new login.

---

## How the Desktop Package Works

Danix does not require Node.js to be installed globally on the user's machine.

The portable desktop package includes:

```txt
dist-portable-ready/
  Danix-Portable.zip
  win-unpacked/
    Danix.exe
    database/
      danix.db
    resources/
      node/
        node.exe
      standalone/
        server.js
        node_modules/
        public/
          danix-logo.svg
      Danix.ico
      app.asar
```

The runtime flow is:

1. `Danix.exe` starts the Electron main process.
2. Electron starts a bundled local Node runtime.
3. The bundled Node process starts the Next.js standalone server on `127.0.0.1`.
4. The preferred port is `3678`.
5. If port `3678` is unavailable, the app selects another free local port.
6. The Electron window loads the selected local server.
7. When the app closes, the internal Node process is terminated.
8. The SQLite database remains stored locally on the user's machine.

Important: the application must be shared as the full ZIP or the complete `win-unpacked` folder. Sending only `Danix.exe` is not enough because the app depends on the bundled `resources`, `standalone`, and `node` folders.

---

## Local Data Storage

Danix stores the main database locally using SQLite.

In development, the default database is:

```txt
local-data/danix.db
```

In the packaged Windows desktop app, the main database is stored in the user's application data directory, usually:

```txt
C:\Users\<user>\AppData\Roaming\Danix\danix.db
```

The exact path can vary depending on the Windows user and environment.

A synchronized copy is also created next to the executable:

```txt
<folder containing Danix.exe>\database\danix.db
```

The official database remains the one stored in the application data directory. The `database\danix.db` file is a synchronized copy intended to make controlled access and backup easier.

---

## Internal API Routes

The interface uses internal Next.js API routes for local CRUD and application operations:

```txt
GET/POST/PUT/DELETE /api/properties
GET/POST/PUT/DELETE /api/expenses
GET/POST/PUT/DELETE /api/sales
GET/POST/PUT/DELETE /api/suppliers
GET/POST/PUT/DELETE /api/payables
GET/POST/PUT/DELETE /api/invoices
GET/POST/PUT/DELETE /api/employees
GET/POST/PUT/DELETE /api/receivables
GET/POST/PUT/DELETE /api/budgets

GET/POST            /api/backup
GET                 /api/admin-events
GET                 /api/health

GET                 /api/auth/status
POST                /api/auth/setup
POST                /api/auth/login
POST                /api/auth/logout
PUT                 /api/auth/password
POST                /api/auth/recover
PUT                 /api/auth/logo

GET/POST/PUT/DELETE /api/users
POST                /api/users/recovery-code
```

These routes read from and write to the local SQLite database.

---

## Business Rules

Key implemented business rules include:

- A sale linked to a property marks the property as sold.
- Editing or deleting a sale recalculates the property status.
- Suppliers with linked payables or invoices cannot be deleted.
- Properties with linked expenses, sales, suppliers, payables, invoices, receivables or budgets cannot be deleted.
- Records linked to a property inherit the property owner's data scope.
- Payables linked to a property and supplier require both records to belong to the same owner.
- Property filters affect payables, cost analysis and exports.
- Cost analysis uses both direct expenses and linked payables.
- Monetary values must be numeric and non-negative.
- API dates are validated using the `yyyy-MM-dd` format.
- Backup import replaces local data and requires a new login.
- Failed login attempts can trigger a temporary local lockout.
- Administrative events are stored locally in SQLite.

---

## Running in Development

### Browser mode

Run:

```cmd
dev-web.cmd
```

Then open:

```txt
http://localhost:3000
```

### Desktop development mode

Terminal 1:

```cmd
dev-web.cmd
```

Terminal 2:

```cmd
dev-desktop.cmd
```

In this mode, Electron loads the local development server at:

```txt
http://localhost:3000
```

---

## Building the Portable Desktop Package

Run:

```cmd
build-portable.cmd
```

The build process:

1. Uses the portable Node runtime included in the project tools.
2. Clears `ELECTRON_RUN_AS_NODE` to avoid Electron running as Node during packaging.
3. Runs the Next.js build.
4. Removes local development data from the standalone output.
5. Copies production runtime dependencies into the standalone package.
6. Copies static assets and public files.
7. Runs `electron-builder`.
8. Copies the Next standalone server to the packaged resources folder.
9. Copies the portable Node runtime to the packaged resources folder.
10. Generates the final portable ZIP.

The valid output for testing and distribution is:

```txt
dist-portable-ready/
```

---

## Available Scripts

Common project scripts include:

```txt
npm run typecheck
npm run lint
npm run build
npm run build:desktop
npm run smoke:api
npm run smoke:backup
npm run smoke:crud
npm run smoke:security
npm run smoke:ui
npm run visual:dashboard
npm run visual:popups
npm run visual:user-security
```

The recommended packaging path is to run:

```cmd
build-portable.cmd
```

---

## Validation Strategy

Danix uses multiple layers of validation:

- TypeScript typecheck.
- ESLint.
- Next.js production build.
- Portable desktop build.
- API smoke tests against the generated standalone output.
- Backup and restore smoke tests.
- CRUD regression smoke tests.
- Security and architecture smoke tests.
- Visual smoke tests with real clicks against the generated `Danix.exe`.
- Automated screenshot capture for dashboard, popups and user/security screens.

This validation strategy is important because desktop packaging can fail in ways that do not appear during browser-only development.

---

## Important Files

```txt
src/app/page.tsx                         # Main interface
src/app/exportReport.ts                  # PDF/print and Excel export logic
src/app/api/*/route.ts                   # Internal CRUD API routes
src/app/api/auth-utils.ts                # Sessions, permissions and current user logic
src/app/api/backup/route.ts              # Manual backup export/import
src/app/api/admin-events/route.ts        # Local administrative event log
src/app/api/validation.ts                # Shared API validators
src/app/api/contracts.ts                 # Shared TypeScript API contracts

src/db/index.ts                          # SQLite initialization, migrations and sync copy
src/db/schema.ts                         # Drizzle schema

electron/main.cjs                        # Electron main process and local server startup
build-portable.cmd                       # Portable build process
scripts/prepare-standalone.cjs           # Runtime dependency preparation
scripts/ui-smoke.cjs                     # Visual smoke test
scripts/api-audit-smoke.cjs              # API audit smoke test
scripts/backup-smoke.cjs                 # Backup smoke test
scripts/crud-regression-smoke.cjs        # CRUD regression smoke test
scripts/security-architecture-smoke.cjs  # Security and data isolation smoke test
```

---

## Engineering Challenges Solved

This project addresses several practical desktop software challenges:

- Bundling a web application into a desktop executable.
- Starting and stopping an internal local server from Electron.
- Running without global Node.js on the user's computer.
- Persisting data locally with SQLite.
- Synchronizing a controlled copy of the database next to the executable.
- Handling port conflicts automatically.
- Keeping user sessions local.
- Validating backup integrity.
- Protecting important business records from unsafe deletion.
- Testing the final packaged desktop application, not only the source code.

---

## Current Limitations

- The application is currently focused on Windows desktop usage.
- The main persistence model is local SQLite, not multi-device cloud synchronization.
- Backup and restore are manual administrative actions.
- The app should be distributed as a full ZIP or complete unpacked folder, not as a standalone executable file.
- Security decisions are optimized for a local desktop app running on `127.0.0.1`, not for a public internet-facing SaaS.

---

## What This Project Demonstrates

This repository demonstrates:

- Desktop application delivery with web technologies.
- Offline-first product architecture.
- Local persistence and backup strategy.
- Internal API design.
- Practical user and permission management.
- Business rule enforcement.
- Windows packaging with Electron.
- Automated validation of the packaged application.
- Product-oriented engineering beyond simple UI prototypes.

---

## Author

Ailton Santana Reis

Software Engineering student focused on backend engineering, desktop applications, local-first software, product architecture and reliable systems.

## Estado da ultima build verificada

Ultima build local verificada neste projeto:

- Pasta: `dist-portable-ready/win-unpacked/`
- ZIP: `dist-portable-ready/Danix-Portable.zip`
- Tamanho do ZIP na ultima verificacao: aproximadamente `368 MiB` (`386,25 MB` decimais)
- Executavel principal: `dist-portable-ready/win-unpacked/Danix.exe`
- Runtime desktop validado: Electron `39.8.5`
- Framework web validado: Next.js `16.2.9`
- PostCSS validado: `8.5.10`

Validacoes realizadas na ultima build:

- O ZIP foi extraido em uma pasta externa na Area de Trabalho.
- A extracao limpa continha `Danix.exe`, `resources/node/node.exe`, `resources/standalone/server.js`, `next`, `react` e `react-dom`.
- O servidor interno da extracao externa respondeu `{"ok":true}` em `/api/health`.
- O fluxo de inicializacao do `Danix.exe` extraido foi validado pelo `startup.log`: o Electron iniciou o Node portatil, subiu o Next local e marcou o servidor como pronto.
- A API local respondeu em `http://127.0.0.1:3678/api/health` quando a porta estava livre.
- Com a porta `3678` ocupada, o app localizou automaticamente outra porta livre.
- Ao fechar o app, o processo Node do servidor interno foi encerrado e a porta foi liberada.
- A pasta `database` foi criada ao lado do executavel e recebeu uma copia sincronizada de `danix.db`.
- `typecheck` e `eslint` passaram usando o Node portatil do projeto.
- O smoke de API confirmou protecao do ultimo administrador ativo.
- O smoke de API confirmou que dados criados por admin para imovel de outro usuario acompanham o dono do imovel.
- O smoke de API confirmou que codigo de recuperacao usado uma vez nao pode ser reutilizado.
- O smoke de API do standalone gerado confirmou cadastro de imovel sem valor de compra, fornecedor com categoria/e-mail opcionais, contas a pagar parceladas, marcacao como pago, notas fiscais, funcionarios, contas a receber, orcamentos, logo de exportacao por usuario e copia `database\danix.db`.
- O smoke de API do standalone confirmou que imoveis vinculados a notas fiscais, contas a receber ou orcamentos nao podem ser excluidos e retornam erro controlado `409`, nao erro interno.
- O smoke de API do standalone confirmou que fornecedor vinculado a nota fiscal nao pode ser excluido e retorna erro controlado `409`, nao erro interno.
- O smoke de API do standalone confirmou validacao de logo de exportacao: rejeita tipo invalido, rejeita arquivo grande e aceita imagem valida.
- O smoke de CRUD do standalone executou duas rodadas com tres ciclos completos de inclusao, alteracao, permanencia apos mudanca de status e exclusao definitiva usando banco temporario isolado.
- O smoke visual com cliques reais no `Danix.exe` gerado confirmou primeiro acesso/login, navegacao por abas, cadastro de imovel, despesa, fornecedor, contas a pagar parceladas, marcar como pago, notas fiscais, funcionarios, contas a receber com filtros, orcamentos, analise de custo, exportacoes, usuarios, bloqueio e desbloqueio.
- O smoke visual com cliques reais tambem confirmou o novo fluxo de cadastro em popup para imoveis, despesas, fornecedores, contas a pagar, notas fiscais, funcionarios, contas a receber e orcamentos.
- A build atual possui seletor de tema em tempo real na barra superior, com opcoes `Tema claro` e `Tema escuro`. O tema claro mantem o menu lateral escuro, deixa o conteudo do app claro e usa botoes principais azuis. As exportacoes PDF/Excel nao foram alteradas por esse tema.
- O dashboard permite ocultar e reexibir blocos visualmente pelo proprio app. Essa preferencia fica em `localStorage` e nao altera dados financeiros nem exportacoes.
- O botao de PDF personalizado recebeu contraste proprio no tema claro para nao ficar apagado.
- O smoke visual com cliques reais confirmou a alternancia entre tema claro e tema escuro.
- O smoke visual com cliques reais foi reexecutado apos a correcao de custos e confirmou que uma despesa cadastrada aparece na analise de custo e no dashboard em gastos por categoria.
- O dashboard atual possui tres graficos adicionais: barras por categoria, pizza por status das contas e area de evolucao mensal.
- A aba de imoveis usa lista retangular com efeito flutuante, valores alinhados a direita e expansao inline logo abaixo do imovel selecionado.
- O card principal de imoveis foca em valores pagos, em aberto e atrasados. O ROI nao e exibido no card principal.
- A aba de fornecedores usa lista compacta com linhas flutuantes, acoes sempre visiveis, status, contato, categoria e imovel relacionado.
- As abas de despesas, vendas e contas a pagar tambem usam linhas flutuantes, valores destacados a direita, layout responsivo e acoes rapidas sempre visiveis.
- O smoke visual foi atualizado para testar o botao de pagamento dentro da nova linha de conta a pagar, sem depender de tabela HTML.
- Estados vazios nas principais abas agora usam um padrao unico com acao direta para abrir o cadastro correspondente quando aplicavel.
- O tema claro recebeu ajustes de contraste em chips/status e cores mais suaves no grafico de status das contas.
- A interface recebeu ajustes responsivos para telas menores que `1200px`, com menu lateral mais compacto, busca responsiva e protecao contra textos/valores longos escaparem dos cards.
- A captura visual automatizada do dashboard gera PNGs dos estados vazio/populado, tema claro/escuro e largura compacta em `tmp-dashboard-captures/screenshots/`.
- A captura visual automatizada de popups gera PNGs de imoveis, despesas, vendas, fornecedores, contas a pagar, contas a receber, notas fiscais, funcionarios, orcamentos e PDF personalizado em `tmp-popup-captures/screenshots/`.
- A captura visual automatizada de usuarios/seguranca confirma o contraste do codigo de recuperacao e o enquadramento do usuario no topo em `tmp-user-security-captures/screenshots/`.
- Os popups de cadastro/edicao usam base compacta compartilhada, largura padronizada, cantos menos arredondados e campos mais baixos para reduzir rolagem.
- Os popups principais abrem centralizados horizontalmente e abaixo da barra superior do usuario. Na ultima captura em viewport `1500x950`, imoveis, despesas, vendas, fornecedores, contas a pagar, contas a receber, notas fiscais, funcionarios e orcamentos ficaram em `top: 96`, `left: 370`, `width: 760`. O PDF personalizado ficou em `top: 96`, `left: 340`, `width: 820`.
- A aba de usuarios possui rotina administrativa de exportacao/importacao manual de backup completo do banco local.
- A importacao de backup valida integridade SQLite, substitui os dados locais e exige novo login para carregar os dados restaurados.
- A aba de usuarios/conta possui troca de senha para o usuario logado; apos trocar a senha, sessoes antigas sao invalidadas e e necessario entrar novamente.
- A API possui bloqueio temporario local apos muitas tentativas de login falhas.
- Eventos administrativos importantes sao registrados localmente em `admin_events`, incluindo criacao/edicao/desativacao de usuarios, codigos de recuperacao e backup.
- O dashboard exibe alerta visual quando existem contas a pagar em aberto vencendo nos proximos 7 dias.
- A UI traduz mensagens tecnicas conhecidas das APIs para mensagens em portugues; detalhes tecnicos ficam em logs/console.
- Imoveis, despesas, vendas, fornecedores, notas fiscais, funcionarios e orcamentos possuem filtros pre-definidos alem da pesquisa livre. Notas fiscais usam apenas filtro de status para evitar excesso visual; funcionarios filtram por ativo/inativo.
- Contas a pagar e contas a receber possuem acoes alternaveis: marcar/desmarcar como pago ou recebido.
- `typecheck`, `eslint`, `next build --webpack`, build portatil, captura visual do dashboard, captura visual de popups, smoke de backup, smoke de seguranca/arquitetura e smoke visual passaram na build atual.
- A correcao de custos foi validada com `typecheck`, `eslint`, `next build --webpack`, build portatil e smoke de CRUD: analise de custo, gastos por categoria, detalhe do imovel e resumo de exportacao usam despesas diretas mais contas a pagar filtradas.
- Somente `dist-portable-ready/` deve ser considerada build valida para teste, distribuicao e analise. Builds antigas `dist-portable/` e `dist-portable-final/`, temporarios de smoke/auditoria (`tmp-*`) e logs antigos foram removidos para evitar confusao.
- A auditoria pos-limpeza verificou os arquivos ativos do projeto, confirmou o `main` valido em `electron/main.cjs`, ausencia de referencias antigas relevantes fora da build atual, `npm audit --omit=dev` sem vulnerabilidades de runtime, build Next, build portatil, smoke de API, smoke de CRUD e smoke visual completos.

## Funcionalidades principais

- Dashboard financeiro focado em gastos, contas pagas, pendentes e atrasadas, com graficos de categoria, status e evolucao mensal, alem de controle local para ocultar e reexibir blocos.
- Alerta visual para contas a pagar em aberto com vencimento nos proximos 7 dias.
- Cadastro e edicao de imoveis.
- Listagem de imoveis em formato retangular com efeito flutuante, valores pagos/em aberto/atrasados a direita e expansao inline logo abaixo do item selecionado.
- Cadastros e edicoes em popup compacto, mantendo as listas separadas dos formularios.
- Seletor de tema em tempo real, com tema claro no conteudo principal do app, menu lateral escuro, botoes principais azuis e opcao de voltar ao tema escuro original.
- Registro de despesas.
- Registro de vendas.
- Cadastro de fornecedores.
- Contas a pagar.
- Notas fiscais.
- Anexo local de nota fiscal em PDF/JPEG/PNG/WebP para notas cadastradas diretamente, despesas com NF e contas a pagar com NF.
- Funcionarios.
- Contas a receber.
- Orcamentos.
- Contas a pagar permitem marcar e desmarcar pagamento mantendo o registro visivel.
- Contas a receber permitem confirmar e desmarcar recebimento mantendo o registro visivel.
- Associacao opcional de fornecedores e contas a pagar a um imovel.
- Consulta de contas por fornecedor, produto, servico, NF/REC, forma de pagamento, status e observacao.
- Pesquisa livre nas abas de imoveis, despesas, vendas, fornecedores, contas a pagar, notas fiscais, funcionarios, contas a receber e orcamentos.
- Filtros pre-definidos em imoveis, despesas, vendas, contas a pagar, contas a receber, fornecedores, notas fiscais, funcionarios e orcamentos.
- Parcelamento de contas a pagar com datas opcionais por parcela.
- Analise de custo por despesa, produto ou servico, com percentual sobre o total gasto.
- Controle local de usuarios, sessoes, permissoes e recuperacao por codigo.
- Troca de senha do usuario logado com invalidacao das sessoes anteriores.
- Bloqueio temporario local apos muitas tentativas de login falhas.
- Log local de eventos administrativos importantes.
- Bloqueio interno do app com solicitacao de senha.
- Logo de exportacao por usuario para relatorios PDF.
- Backup manual completo por administrador, com exportacao/importacao de arquivo SQLite.
- Exportacao de relatorio para PDF/impressao com fornecedores, contas a pagar, notas fiscais, funcionarios, contas a receber, orcamentos e analise de custo.
- Exportacao de PDF personalizado em fluxo separado, com preenchimento manual antes da impressao, exemplo editavel, logo do usuario e campos de assinatura.
- Exportacao para Excel em `XLSX` ou `XML` com abas equivalentes ao relatorio.

## Armazenamento dos dados

O Danix salva os dados em SQLite local. Nao ha Supabase, Firebase, banco remoto ou API externa para persistencia dos dados principais.

Em desenvolvimento, o banco padrao fica em:

```text
local-data/danix.db
```

No executavel desktop, o banco principal fica na pasta local de dados do usuario do Windows, normalmente:

```text
C:\Users\<usuario>\AppData\Roaming\Danix\danix.db
```

O caminho real pode variar conforme o Windows e o usuario logado. Ele e definido pelo Electron com `app.getPath("userData")`.

Tambem e criada uma pasta acessivel ao lado do executavel:

```text
<pasta onde esta o Danix.exe>\database\danix.db
```

Esse arquivo e uma copia sincronizada do banco principal. O banco oficial continua sendo o de `AppData\Roaming\Danix`, e a copia da pasta `database` e atualizada na inicializacao e depois de cada gravacao feita pelas APIs internas. A sincronizacao usa o mecanismo de backup do SQLite para evitar copiar o arquivo enquanto ele esta em uso.

Se existir um banco antigo chamado `imobcontrol.db` na mesma pasta de dados e ainda nao existir `danix.db`, o app copia o banco antigo para `danix.db` na primeira inicializacao. Isso preserva dados de versoes anteriores.

## Como a versao portatil funciona

O pacote portatil nao depende de Node instalado globalmente no computador do usuario.

Na build atual:

- `Danix.exe` e o processo Electron principal.
- O servidor interno Next.js fica em `resources/standalone/server.js`.
- O pacote leva um Node portatil em `resources/node/node.exe`.
- O standalone leva as dependencias de runtime em `resources/standalone/node_modules`.
- Ao abrir o app, o Electron inicia esse Node local para subir o servidor Next em `127.0.0.1`.
- A porta preferencial e `3678`.
- Se a porta `3678` estiver ocupada, o app procura automaticamente outra porta livre a partir dela.
- A janela do Electron carrega a porta realmente escolhida.
- Ao fechar o app, o processo Node do servidor interno e encerrado e a porta usada fica livre novamente.
- O banco SQLite principal e gravado na pasta de dados local do usuario.
- Uma copia sincronizada fica em `database\danix.db` ao lado do executavel para facilitar acesso e compartilhamento controlado.

Importante: para compartilhar o app, envie o ZIP inteiro ou a pasta `win-unpacked` inteira. Nao envie somente `Danix.exe`, porque ele depende das pastas `resources`, `standalone` e `node`.

Tambem e seguro renomear o arquivo ZIP antes de enviar ou copiar. O nome do ZIP nao e usado pelo app. Depois da extracao, mantenha a estrutura interna da pasta.

Se o app for iniciado a partir de um PowerShell que tenha `ELECTRON_RUN_AS_NODE=1`, o Electron pode se comportar como Node e fechar sem janela. Antes de testar pelo terminal, limpe a variavel:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
```

Ao abrir por duplo clique, essa variavel normalmente nao existe, a menos que tenha sido configurada globalmente no Windows.

## Estrutura importante do pacote

Depois de gerar a build, os arquivos importantes ficam assim:

```text
dist-portable-ready/
  Danix-Portable.zip
  win-unpacked/
    Danix.exe
    database/
      danix.db
    resources/
      node/
        node.exe
      standalone/
        server.js
        node_modules/
        public/
          danix-logo.svg
      Danix.ico
      app.asar
```

A pasta `database` e criada em tempo de execucao. Ela pode nao existir imediatamente dentro do ZIP antes da primeira abertura do aplicativo.

## Como testar em desenvolvimento no navegador

Execute:

```bat
dev-web.cmd
```

Depois abra:

```text
http://localhost:3000
```

## Como testar em desenvolvimento como desktop

Terminal 1:

```bat
dev-web.cmd
```

Terminal 2:

```bat
dev-desktop.cmd
```

Nesse modo, o Electron abre `http://localhost:3000`.

## Como gerar o pacote portatil

Execute:

```bat
build-portable.cmd
```

O script faz, nesta ordem:

1. Usa o Node portatil de `.tools/node-v20.19.3-win-x64`.
2. Limpa `ELECTRON_RUN_AS_NODE` para evitar que o Electron rode como Node durante o empacotamento.
3. Executa `next build --webpack` com `--preserve-symlinks` e `--preserve-symlinks-main`.
4. Remove `local-data` do standalone para nao empacotar banco local.
5. Executa `scripts/prepare-standalone.cjs`, que copia as dependencias de producao e suas dependencias instaladas para `.next/standalone/node_modules`.
6. Copia os assets estaticos de `.next/static`.
7. Copia a pasta `public`.
8. Executa `electron-builder`.
9. Copia `.next/standalone` para `dist-portable-ready/win-unpacked/resources/standalone`.
10. Copia o Node portatil para `dist-portable-ready/win-unpacked/resources/node/node.exe`.
11. Copia `Danix.ico` para `resources`.
12. Gera `dist-portable-ready/Danix-Portable.zip` com `tar -a -cf` a partir de dentro de `win-unpacked`, sem incluir uma entrada raiz `.` no ZIP.

## Scripts do projeto

- `dev-web.cmd`: inicia o Next em modo desenvolvimento usando `--preserve-symlinks` e `--preserve-symlinks-main`.
- `dev-desktop.cmd`: abre o Electron apontando para o Next em desenvolvimento usando `--preserve-symlinks` e `--preserve-symlinks-main`.
- `build-portable.cmd`: gera a build desktop portatil.
- `scripts/ui-smoke.cjs`: abre o `Danix.exe` gerado e executa smoke visual com cliques reais via Electron/Chromium DevTools.
- `scripts/dashboard-visual-capture.cjs`: abre o `Danix.exe` gerado e captura PNGs automatizados do dashboard vazio, populado, tema claro, tema escuro e largura compacta.
- `scripts/popup-visual-capture.cjs`: abre o `Danix.exe` gerado, clica nos botoes de cadastro/exportacao e captura PNGs/metricas dos popups em `tmp-popup-captures/`.
- `scripts/user-security-visual-capture.cjs`: abre o `Danix.exe` gerado, cria usuario em banco temporario e captura a aba de usuarios no tema claro para validar codigo de recuperacao e topo do usuario.
- `scripts/api-audit-smoke.cjs`: sobe o standalone gerado com banco temporario e valida protecoes de exclusao, validacao de logo e copia local do banco.
- `scripts/backup-smoke.cjs`: sobe o standalone gerado com banco temporario e valida exportacao/importacao manual de backup.
- `scripts/crud-regression-smoke.cjs`: sobe o standalone gerado com banco temporario e valida inclusao, alteracao, permanencia apos status e exclusao definitiva em ciclos repetidos.
- `scripts/security-architecture-smoke.cjs`: sobe o standalone gerado com banco temporario e valida isolamento por usuario, permissao `viewAllData`, bloqueio de login e troca de senha.
- `npm run typecheck`: executa TypeScript sem emitir arquivos.
- `npm run lint`: executa ESLint.
- `npm run build`: executa `next build --webpack`.
- `npm run build:desktop`: chama `build-portable.cmd`.
- `npm run demo:seed`: adiciona/recria dados ficticios `DEMO DANIX` no banco local real do usuario ativo.
- `npm run demo:remove`: remove apenas os dados ficticios `DEMO DANIX` do banco local.
- `npm run smoke:api`: executa o smoke de API contra o standalone gerado em `dist-portable-ready/win-unpacked`.
- `npm run smoke:backup`: executa exportacao/importacao de backup contra o standalone gerado com banco temporario isolado.
- `npm run smoke:crud`: executa ciclos reais de CRUD contra o standalone gerado com banco temporario isolado.
- `npm run smoke:security`: executa validacoes de seguranca local e arquitetura contra o standalone gerado com banco temporario isolado.
- `npm run smoke:ui`: executa o smoke visual com cliques reais no `Danix.exe` gerado.
- `npm run visual:dashboard`: gera capturas visuais automatizadas em `tmp-dashboard-captures/screenshots/` usando banco temporario isolado.
- `npm run visual:popups`: gera capturas visuais automatizadas dos popups em `tmp-popup-captures/screenshots/` e metricas em `tmp-popup-captures/popup-metrics.json`, usando banco temporario isolado.
- `npm run visual:user-security`: gera captura visual da aba de usuarios/seguranca em `tmp-user-security-captures/screenshots/`, usando banco temporario isolado.

Os scripts `npm run ...` usam os caminhos definidos em `package.json`, que apontam para o Node portatil e usam `--preserve-symlinks`/`--preserve-symlinks-main`. Isso evita falhas de resolucao de caminho em ambientes onde o Node nao consegue fazer `lstat` em algum diretorio ancestral do usuario.

Observacao: `npm run ...` exige que `npm` esteja disponivel no terminal. Para gerar o pacote portatil neste projeto, o caminho recomendado e executar diretamente:

```bat
build-portable.cmd
```

## APIs internas

As telas usam rotas internas do Next:

- `GET/POST/PUT/DELETE /api/properties`
- `GET/POST/PUT/DELETE /api/expenses`
- `GET/POST/PUT/DELETE /api/sales`
- `GET/POST/PUT/DELETE /api/suppliers`
- `GET/POST/PUT/DELETE /api/payables`
- `GET/POST/PUT/DELETE /api/invoices`
- `GET/POST/PUT/DELETE /api/employees`
- `GET/POST/PUT/DELETE /api/receivables`
- `GET/POST/PUT/DELETE /api/budgets`
- `GET/POST /api/backup`
- `GET /api/admin-events`
- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `PUT /api/auth/password`
- `POST /api/auth/recover`
- `PUT /api/auth/logo`
- `GET/POST/PUT/DELETE /api/users`
- `POST /api/users/recovery-code`

Essas rotas leem e gravam no SQLite local usando `better-sqlite3` e Drizzle.

## Controle de usuarios e permissoes

- No primeiro acesso, o primeiro usuario criado se torna administrador.
- Administradores recebem todas as permissoes.
- Usuarios comuns so acessam as telas permitidas.
- Dados de imoveis, despesas, vendas, fornecedores e contas a pagar ficam vinculados ao usuario proprietario.
- Usuarios sem permissao `viewAllData` veem apenas os proprios dados.
- Usuarios com permissao `viewAllData` podem visualizar todos os dados locais.
- A exportacao respeita os dados carregados para o usuario logado.
- Cada usuario pode salvar uma logo propria para aparecer no relatorio PDF.
- Administradores podem criar, editar e desativar usuarios.
- Quem tem permissao de usuarios ou recuperacao pode gerar codigos de recuperacao.
- A recuperacao de senha usa codigo local. Nao ha envio de e-mail ou SMS.
- O codigo de recuperacao e invalidado depois de usado com sucesso.
- A API impede rebaixar ou desativar o ultimo administrador ativo.
- Apenas administradores podem exportar/importar backup completo do banco local.
- Apenas administradores com permissao de usuarios podem consultar os eventos administrativos locais em `/api/admin-events`.
- O cookie de sessao usa `httpOnly` e `sameSite=lax`. A opcao `secure` permanece `false` porque o app desktop carrega o servidor local por `http://127.0.0.1`; usar `secure=true` exigiria HTTPS e quebraria a sessao local.

## Regras de negocio relevantes

- Uma venda vinculada a um imovel marca o imovel como `sold`.
- Ao editar uma venda para outro imovel, o status do imovel antigo e recalculado.
- Ao excluir uma venda, o status do imovel e recalculado.
- Um fornecedor com contas a pagar vinculadas nao pode ser excluido.
- Um fornecedor com nota fiscal vinculada nao pode ser excluido.
- Um imovel com despesas, vendas, fornecedores, contas a pagar, notas fiscais, contas a receber ou orcamentos vinculados nao pode ser excluido.
- Despesas, vendas, fornecedores e contas a pagar vinculados a um imovel herdam o dono desse imovel.
- Uma conta a pagar vinculada a imovel e fornecedor exige que ambos pertencam ao mesmo dono.
- O filtro por imovel tambem afeta contas a pagar, analise de custo e exportacao.
- A exportacao usa os dados filtrados carregados na tela do usuario logado.
- O calculo individual do imovel inclui despesas diretas e contas a pagar vinculadas.
- A analise de custo e o dashboard em gastos por categoria usam a mesma base de custos: despesas diretas e contas a pagar filtradas.
- Imoveis podem ser cadastrados sem valor de compra ou valor atual estimado; a tela de imoveis foca em despesas, fornecedores e contas vinculadas.
- Categorias de despesas e fornecedores sao opcionais e editaveis como texto livre com sugestoes.
- E-mail de fornecedor, numero de NF/REC e data da NF sao opcionais.
- O prazo de contas a pagar e calculado pela diferenca entre a data atual e o vencimento.
- Contas a pagar podem ser parceladas. Cada parcela e salva como uma conta individual com numero da parcela e total de parcelas.
- Marcar uma conta como paga altera somente o status; ela continua aparecendo em contas a pagar, analise de custo e exportacao enquanto passar pelos filtros aplicados.
- Contas a receber possuem filtro rapido por tudo, dia, semana, mes ou ano.
- O dashboard alerta sobre contas a pagar em aberto vencendo de hoje ate os proximos 7 dias, respeitando os filtros e dados carregados do usuario.
- A importacao de backup substitui os dados locais, limpa sessoes e exige novo login.
- A troca de senha do usuario logado exige a senha atual, grava novo hash e invalida sessoes antigas.
- Muitas tentativas de login falhas para o mesmo usuario geram bloqueio temporario local.
- Eventos administrativos sao gravados em SQLite local na tabela `admin_events`.
- Mensagens tecnicas retornadas por APIs antigas sao traduzidas na UI quando conhecidas; detalhes tecnicos continuam registrados em logs/console.
- Notas fiscais aceitam cliente, numero e datas opcionais, tipo editavel e status editavel.
- A aba de notas fiscais tambem exibe notas informadas nos formularios de despesas e contas a pagar.
- Anexos de notas fiscais ficam salvos localmente no SQLite, vinculados a origem real da nota: `invoices`, `expenses` ou `payables`.
- A interface permite anexar/substituir, visualizar e baixar anexos de notas fiscais em PDF/JPEG/PNG/WebP.
- Funcionarios aceitam status ativo/inativo e filtro correspondente na aba.
- Orcamentos aceitam cliente opcional, imovel digitavel por sugestao, status editavel e pesquisa livre.
- Datas recebidas pelas APIs sao validadas no formato `yyyy-MM-dd`.
- Valores monetarios devem ser numericos e nao negativos.

## Arquivos principais

- `src/app/page.tsx`: interface principal do Danix.
- `src/app/exportReport.ts`: geracao de relatorio HTML/PDF, PDF personalizado, Excel XML e Excel XLSX.
- `src/app/api/*/route.ts`: rotas internas de CRUD.
- `src/app/api/auth-utils.ts`: sessoes, permissoes, hashes e usuario logado.
- `src/app/api/auth/logo/route.ts`: salvamento local da logo de exportacao do usuario.
- `src/app/api/auth/password/route.ts`: troca de senha do usuario logado.
- `src/app/api/admin-events/route.ts`: consulta administrativa do log local de eventos.
- `src/app/api/backup/route.ts`: exportacao/importacao manual de backup completo por administrador.
- `src/app/api/validation.ts`: validadores compartilhados para rotas internas.
- `src/app/api/contracts.ts`: contratos TypeScript compartilhados para payloads e respostas de API.
- `src/db/index.ts`: inicializacao do SQLite local, criacao/migracao de tabelas e sincronizacao da copia em `database`.
- `src/db/schema.ts`: schema Drizzle.
- `electron/main.cjs`: processo principal do Electron e inicializacao do servidor local.
- Nao existe `main.cjs` ativo na raiz; o `main` valido do Electron e `electron/main.cjs`, conforme `package.json`.
- `build-portable.cmd`: build e montagem final do pacote portatil.
- `scripts/prepare-standalone.cjs`: copia dependencias de runtime para o standalone portatil.
- `scripts/seed-demo-data.cjs`: cria ou remove dados ficticios `DEMO DANIX` no banco local real para visualizacao do app.
- `scripts/api-audit-smoke.cjs`: smoke de API do standalone gerado.
- `scripts/backup-smoke.cjs`: smoke de exportacao/importacao manual de backup do standalone gerado.
- `scripts/crud-regression-smoke.cjs`: smoke de CRUD repetido do standalone gerado.
- `scripts/security-architecture-smoke.cjs`: smoke de isolamento de usuarios, `viewAllData`, bloqueio de login e troca de senha.
- `scripts/ui-smoke.cjs`: smoke visual com cliques reais no executavel gerado.
- `scripts/dashboard-visual-capture.cjs`: captura automatizada em PNG dos principais estados do dashboard.
- `scripts/popup-visual-capture.cjs`: captura automatizada em PNG e JSON de metricas dos popups.
- `Danix.ico`: icone nativo do executavel.
- `public/danix-logo.svg`: logo usada na interface.

## Logs de inicializacao

Se o app desktop falhar ao abrir, o processo principal tenta registrar detalhes em:

```text
C:\Users\<usuario>\AppData\Roaming\Danix\startup.log
```

Esse log e util para diagnosticar erro de inicializacao do servidor local, porta ocupada, arquivo ausente ou falha de dependencia nativa.

Um inicio saudavel do portatil registra linhas parecidas com:

```text
Starting local Next server with <pasta>\resources\node\node.exe from <pasta>\resources\standalone\server.js on port 3678
Local Next server ready at http://127.0.0.1:3678
```

Se o executavel aparecer no Gerenciador de Tarefas mas a janela nao abrir, verifique esse log. Nas validacoes recentes, a causa real encontrada fora da pasta original foi dependencia ausente no standalone; isso foi corrigido com `scripts/prepare-standalone.cjs`.

## Observacoes reais da auditoria

- O pacote portatil precisa ser compartilhado como ZIP ou pasta completa, nao como executavel isolado.
- O servidor interno tenta usar a porta `3678` por padrao e muda automaticamente para outra porta livre se ela estiver ocupada.
- O banco de dados nao e empacotado dentro do ZIP.
- A pasta `database` ao lado do executavel e criada em tempo de execucao, se ainda nao existir.
- A copia `database\danix.db` e atualizada depois de criacoes, edicoes e exclusoes feitas pelo app.
- A build atual copia a cadeia de dependencias de runtime para o standalone, evitando que o app dependa da pasta original do projeto.
- O ZIP atual inclui `react`, `react-dom`, `next` e demais dependencias necessarias dentro de `resources/standalone/node_modules`.
- O ZIP pode ser renomeado antes de compartilhar; o importante e extrair e manter todos os arquivos internos juntos.
- Electron foi atualizado para `39.8.5`, saindo da faixa vulneravel apontada pelo `npm audit`.
- Next.js foi atualizado para `16.2.9` e PostCSS foi fixado em `8.5.10`.
- `concurrently` foi removido e substituido por `dev.cmd`, eliminando a vulnerabilidade critica ligada a `shell-quote`.
- O `npm audit` atual nao reporta vulnerabilidades em Electron, Next/PostCSS ou dependencias de runtime do app.
- Restam 4 apontamentos de auditoria ligados a `drizzle-kit/esbuild`, usados como ferramentas de desenvolvimento/build. Eles nao entram no fluxo normal do usuario final usando o `Danix.exe`.
- Nao foi aplicado `npm audit fix --force`, porque ele sugere mudancas amplas e potencialmente quebradicas.
- Ainda aparecem avisos de engine para pacotes auxiliares de rebuild (`@electron/rebuild`/`node-abi`), porque esperam Node mais novo. A build atual validada usa Node 20 portatil para o servidor e para o SQLite, com `npmRebuild` desativado.
- A auditoria de runtime `npm audit --omit=dev` foi executada com o npm portatil e retornou `found 0 vulnerabilities`.

## Auditoria visual e usabilidade

Itens corrigidos na interface atual:

- Remocao do artefato visual `!` que aparecia no card de contas atrasadas.
- Remocao visual do titulo duplicado da barra superior, mantendo os nomes das abas apenas no menu lateral e no conteudo da propria tela.
- Popups de cadastro e edicao com largura menor, altura maxima, rolagem interna e posicao vertical padronizada abaixo da barra superior do usuario.
- Regras visuais para evitar que valores monetarios longos vazem dos cards.
- Imoveis com expansao inline logo abaixo do item selecionado.
- Imoveis com valores resumidos alinhados a direita e detalhes completos no painel expandido.
- Listas de recebiveis, notas, funcionarios e orcamentos com efeito flutuante.
- Contas a pagar e contas a receber com botoes alternaveis para marcar/desmarcar pago ou recebido.
- Dashboard com tres graficos adicionais para leitura rapida dos dados.

Melhorias recomendadas para proximas etapas:

- Criar um componente unico de modal/popup para todos os formularios, com cabecalho, acoes, foco inicial e fechamento por teclado padronizados.
- Melhorar acessibilidade dos graficos com resumo textual dos dados principais para usuarios que nao dependem apenas da leitura visual.
- Continuar reduzindo repeticao de JSX nas listas que ja usam o padrao visual de linhas flutuantes.
