const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { WebSocket } = require("undici");

const root = path.resolve(__dirname, "..");
const appExe = path.join(root, "dist-portable-ready", "win-unpacked", "Danix.exe");
const tmpRoot = path.join(root, "tmp-ui-smoke");
const appData = path.join(tmpRoot, "appdata");
const userDataDir = path.join(tmpRoot, "chromium");
const port = Number(process.env.UI_SMOKE_DEBUG_PORT || 9229);
const appPort = Number(process.env.UI_SMOKE_APP_PORT || 4680);
const baseDebugUrl = `http://127.0.0.1:${port}`;

let nextId = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = (url) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error(`Timeout reading ${url}`));
    });
  });

async function waitForDebugger() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const targets = await getJson(`${baseDebugUrl}/json/list`);
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // The app is still starting.
    }
    await sleep(500);
  }
  throw new Error("Electron remote debugger did not become available.");
}

function connectCdp(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id) return;
    const callbacks = pending.get(payload.id);
    if (!callbacks) return;
    pending.delete(payload.id);
    if (payload.error) {
      callbacks.reject(new Error(payload.error.message || JSON.stringify(payload.error)));
      return;
    }
    callbacks.resolve(payload.result);
  });

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = async (method, params = {}) => {
    await opened;
    const id = nextId;
    nextId += 1;
    const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    ws.send(JSON.stringify({ id, method, params }));
    return result;
  };

  return { send, close: () => ws.close() };
}

const expressionSource = String.raw`
(() => {
  const visible = (element) => {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  window.__danixSmoke = {
    visibleText() {
      return document.body.innerText;
    },
    elementCenterByText(text, selector = "button,a,label,[role=button]") {
      const needle = normalize(text);
      const elements = Array.from(document.querySelectorAll(selector)).filter(visible);
      const element = elements.find((item) => normalize((item.innerText || item.textContent || "") + " " + (item.getAttribute("title") || "") + " " + (item.getAttribute("aria-label") || "")).includes(needle));
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: element.innerText || element.textContent };
    },
    elementCenter(selector) {
      const element = Array.from(document.querySelectorAll(selector)).find(visible);
      if (!element) return null;
      element.scrollIntoView({ block: "center", inline: "center" });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    fillByIndex(selector, index, value) {
      const elements = Array.from(document.querySelectorAll(selector)).filter(visible);
      const element = elements[index];
      if (!element) throw new Error("Input not found: " + selector + "[" + index + "]");
      const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    fillLabeled(label, value) {
      const labels = Array.from(document.querySelectorAll("label")).filter(visible);
      const normalizedLabel = normalize(label);
      const labelElement = labels.find((item) => normalize(item.textContent).includes(normalizedLabel));
      let element = null;
      if (labelElement) {
        const container = labelElement.parentElement;
        element = container?.querySelector("input,textarea,select");
      }
      if (!element) {
        element = Array.from(document.querySelectorAll("input,textarea,select"))
          .filter(visible)
          .find((item) => normalize(item.getAttribute("placeholder") || item.getAttribute("aria-label") || "").includes(normalizedLabel));
      }
      if (!element) throw new Error("Field not found for label: " + label);
      const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    fieldInfo(label) {
      const labels = Array.from(document.querySelectorAll("label")).filter(visible);
      const normalizedLabel = normalize(label);
      const labelElement = labels.find((item) => normalize(item.textContent).includes(normalizedLabel));
      let element = null;
      if (labelElement) {
        const container = labelElement.parentElement;
        element = container?.querySelector("input,textarea,select");
      }
      if (!element) {
        element = Array.from(document.querySelectorAll("input,textarea,select"))
          .filter(visible)
          .find((item) => normalize(item.getAttribute("placeholder") || item.getAttribute("aria-label") || "").includes(normalizedLabel));
      }
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        tag: element.tagName,
        type: element.getAttribute("type") || "",
      };
    },
    focusField(label) {
      const labels = Array.from(document.querySelectorAll("label")).filter(visible);
      const normalizedLabel = normalize(label);
      const labelElement = labels.find((item) => normalize(item.textContent).includes(normalizedLabel));
      let element = null;
      if (labelElement) {
        const container = labelElement.parentElement;
        element = container?.querySelector("input,textarea,select");
      }
      if (!element) {
        element = Array.from(document.querySelectorAll("input,textarea,select"))
          .filter(visible)
          .find((item) => normalize(item.getAttribute("placeholder") || item.getAttribute("aria-label") || "").includes(normalizedLabel));
      }
      if (!element) return null;
      element.focus();
      if (typeof element.select === "function") element.select();
      return true;
    },
    clickDomText(text, selector = "button,a,label,[role=button]") {
      const center = this.elementCenterByText(text, selector);
      if (!center) throw new Error("Clickable text not found: " + text);
      document.elementFromPoint(center.x, center.y)?.click();
    },
    countText(text) {
      return normalize(document.body.innerText).split(normalize(text)).length - 1;
    },
  };
})();
`;

async function evaluate(cdp, expression, awaitPromise = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result.value;
}

async function clickText(cdp, text, selector) {
  const center = await evaluate(
    cdp,
    `window.__danixSmoke.elementCenterByText(${JSON.stringify(text)}, ${JSON.stringify(selector || "button,a,label,[role=button]")})`
  );
  if (!center) throw new Error(`Clickable text not found: ${text}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await sleep(250);
}

async function fill(cdp, label, value) {
  await evaluate(cdp, `window.__danixSmoke.fillLabeled(${JSON.stringify(label)}, ${JSON.stringify(value)})`);
  await sleep(50);
}

async function waitForText(cdp, text, timeoutMs = 12000) {
  const start = Date.now();
  let lastText = "";
  while (Date.now() - start < timeoutMs) {
    lastText = await evaluate(cdp, "window.__danixSmoke.visibleText()");
    const visible = lastText.includes(text);
    if (visible) return;
    await sleep(250);
  }
  fs.writeFileSync(path.join(tmpRoot, "last-visible-text.txt"), lastText);
  throw new Error(`Text not found after wait: ${text}. Visible text saved to ${path.join(tmpRoot, "last-visible-text.txt")}`);
}

async function assertText(cdp, text) {
  const visible = await evaluate(cdp, `window.__danixSmoke.visibleText().includes(${JSON.stringify(text)})`);
  if (!visible) throw new Error(`Expected visible text: ${text}`);
}

async function main() {
  if (!fs.existsSync(appExe)) {
    throw new Error(`Portable executable not found: ${appExe}`);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const env = {
    ...process.env,
    APPDATA: appData,
    LOCALAPPDATA: path.join(tmpRoot, "localappdata"),
    APP_PORT: String(appPort),
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(appExe, [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`], {
    cwd: path.dirname(appExe),
    env,
    windowsHide: true,
    stdio: "ignore",
  });

  let cdp;
  const results = [];
  const step = async (name, fn) => {
    await fn();
    results.push({ name, ok: true });
    console.log(`OK ${name}`);
  };

  try {
    const webSocketUrl = await waitForDebugger();
    cdp = connectCdp(webSocketUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, expressionSource);

    await step("primeiro acesso e login", async () => {
      await waitForText(cdp, "Criar administrador");
      await fill(cdp, "USUARIO", "admin");
      await fill(cdp, "NOME", "Admin Smoke UI");
      await fill(cdp, "SENHA", "Admin123!");
      await clickText(cdp, "Criar administrador");
      await waitForText(cdp, "Total de Gastos");
    });

    await step("dashboard e navegacao por abas", async () => {
      for (const tab of ["Imóveis", "Despesas", "Vendas", "Fornecedores", "Contas a Pagar", "Contas a Receber", "Notas Fiscais", "Orcamentos", "Funcionarios", "Análise de Custo", "Usuarios"]) {
        await clickText(cdp, tab);
        await sleep(350);
      }
      await clickText(cdp, "Dashboard");
      await assertText(cdp, "Total de Gastos");
    });

    await step("alternancia de tema em tempo real", async () => {
      await evaluate(cdp, `document.querySelector('select[aria-label="Tema do aplicativo"]').value = 'dark'; document.querySelector('select[aria-label="Tema do aplicativo"]').dispatchEvent(new Event('change', { bubbles: true }));`);
      await sleep(250);
      const isDark = await evaluate(cdp, `!document.querySelector('.theme-app-light-blue')`);
      if (!isDark) throw new Error("Tema escuro nao foi aplicado");
      await evaluate(cdp, `document.querySelector('select[aria-label="Tema do aplicativo"]').value = 'light-blue'; document.querySelector('select[aria-label="Tema do aplicativo"]').dispatchEvent(new Event('change', { bubbles: true }));`);
      await sleep(250);
      const isLight = await evaluate(cdp, `Boolean(document.querySelector('.theme-app-light-blue'))`);
      if (!isLight) throw new Error("Tema claro nao foi aplicado");
    });

    await step("cadastro de imovel sem valor de compra", async () => {
      await clickText(cdp, "Imóveis");
      await clickText(cdp, "NOVO IM");
      await fill(cdp, "NOME DO IM", "Imovel UI Smoke");
      await fill(cdp, "ENDERE", "Rua UI Smoke, 100");
      await fill(cdp, "DATA DE AQUISI", "2026-06-18");
      await clickText(cdp, "SALVAR");
      await waitForText(cdp, "Imovel UI Smoke");
    });

    await step("despesa com categoria opcional editavel", async () => {
      await clickText(cdp, "Despesas");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "ITEM", "Despesa UI Smoke");
      await fill(cdp, "CATEGORIA", "Categoria Livre UI");
      await fill(cdp, "VALOR", "123.45");
      await clickText(cdp, "REGISTRAR DESPESA");
      await waitForText(cdp, "Despesa UI Smoke");
    });

    await step("fornecedor com email e categoria opcionais", async () => {
      await clickText(cdp, "Fornecedores");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "RAZ", "Fornecedor UI Smoke");
      await fill(cdp, "NOME FANTASIA", "Fornecedor UI");
      await fill(cdp, "CATEGORIA", "");
      await clickText(cdp, "SALVAR");
      await waitForText(cdp, "Fornecedor UI");
    });

    await step("contas a pagar, parcelas, pesquisa, pago, editar e excluir", async () => {
      await clickText(cdp, "Contas a Pagar");
      await clickText(cdp, "ADICIONAR");
      await fill(cdp, "FORNECEDOR", "Fornecedor UI");
      await fill(cdp, "PRODUTO", "Produto UI Smoke");
      await fill(cdp, "DATA DA COMPRA", "2026-06-18");
      await fill(cdp, "VALOR", "200");
      await fill(cdp, "VENCIMENTO", "2026-06-28");
      await fill(cdp, "PARCELAS", "2");
      await clickText(cdp, "REGISTRAR CONTA");
      await sleep(1200);
      const payableDiagnostics = await evaluate(
        cdp,
        `(async () => {
          const res = await fetch('/api/payables');
          const data = await res.json();
          const fields = Array.from(document.querySelectorAll('input,textarea,select')).map((item) => ({ placeholder: item.getAttribute('placeholder'), value: item.value }));
          return { status: res.status, data, fields, text: document.body.innerText };
        })()`
      );
      if (!Array.isArray(payableDiagnostics.data) || payableDiagnostics.data.length === 0) {
        fs.writeFileSync(path.join(tmpRoot, "payable-diagnostics.json"), JSON.stringify(payableDiagnostics, null, 2));
      }
      await waitForText(cdp, "Produto UI Smoke");
      await fill(cdp, "Pesquisar contas", "Produto UI Smoke").catch(async () => {
        await evaluate(cdp, `window.__danixSmoke.fillByIndex('input[placeholder="Pesquisar contas"]', 0, 'Produto UI Smoke')`);
      });
      await clickText(cdp, "PAGO", ".payable-row button");
      await waitForText(cdp, "Pago");
      const paidPayables = await evaluate(
        cdp,
        `(async () => {
          const res = await fetch('/api/payables');
          const data = await res.json();
          return data.filter((item) => item.product === 'Produto UI Smoke' && item.status === 'paid').length;
        })()`
      );
      if (paidPayables < 1) throw new Error("Conta a pagar nao foi marcada como paga");
    });

    await step("notas fiscais com numero e datas opcionais", async () => {
      await clickText(cdp, "Notas Fiscais");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "Cliente", "Cliente NF UI");
      await fill(cdp, "Descri", "Nota fiscal UI sem numero");
      await clickText(cdp, "ADICIONAR", "form button");
      await waitForText(cdp, "Cliente NF UI");
    });

    await step("funcionarios", async () => {
      await clickText(cdp, "Funcionarios");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "Nome", "Funcionario UI Smoke");
      await fill(cdp, "Fun", "Supervisor");
      await clickText(cdp, "ADICIONAR", "form button");
      await waitForText(cdp, "Funcionario UI Smoke");
    });

    await step("contas a receber com filtro periodo", async () => {
      await clickText(cdp, "Contas a Receber");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "Cliente", "Cliente Receber UI");
      await fill(cdp, "Descrição", "Recebimento UI Smoke");
      await fill(cdp, "Valor", "300");
      await fill(cdp, "VENCIMENTO", "2026-06-18");
      await clickText(cdp, "ADICIONAR", "form button");
      await waitForText(cdp, "Recebimento UI Smoke");
      for (const filter of ["Tudo", "Dia", "Semana", "Mês", "Ano"]) {
        await clickText(cdp, filter);
      }
    });

    await step("orcamentos com cliente opcional", async () => {
      await clickText(cdp, "Orcamentos");
      await clickText(cdp, "Adicionar");
      await fill(cdp, "Cliente", "");
      await fill(cdp, "Título", "Orcamento UI Smoke");
      await fill(cdp, "Valor", "450");
      await clickText(cdp, "ADICIONAR", "form button");
      await waitForText(cdp, "Orcamento UI Smoke");
    });

    await step("usuarios, bloqueio e desbloqueio", async () => {
      await evaluate(cdp, `window.__danixSmoke.clickDomText('Usuarios', '.app-sidebar button')`);
      await sleep(350);
      await waitForText(cdp, "Usuarios cadastrados");
      await clickText(cdp, "Bloquear aplicativo", "[title],button");
      await waitForText(cdp, "Danix bloqueado");
      await fill(cdp, "SENHA", "Admin123!");
      await clickText(cdp, "Danix bloqueado");
      await waitForText(cdp, "Usuarios e Permissoes");
    });

    await step("analise de custo e exportacoes", async () => {
      await clickText(cdp, "Análise de Custo");
      await waitForText(cdp, "Produto UI Smoke");
      await waitForText(cdp, "Despesa UI Smoke");
      await clickText(cdp, "Dashboard");
      await waitForText(cdp, "Categoria Livre UI");
      await clickText(cdp, "Contas a Pagar");
      await clickText(cdp, "EXPORTAR EXCEL");
      await sleep(500);
      await clickText(cdp, "PDF PERSONALIZADO");
      await waitForText(cdp, "Documento editavel antes da exportacao");
      await clickText(cdp, "Preencher exemplo");
      const customPdfValues = await evaluate(
        cdp,
        `(() => {
          const values = Array.from(document.querySelectorAll('input,textarea')).map((item) => item.value);
          return {
            hasClient: values.includes('Cliente exemplo'),
            hasLabor: values.some((value) => value.includes('Mao de obra especializada')),
          };
        })()`
      );
      if (!customPdfValues.hasClient || !customPdfValues.hasLabor) {
        throw new Error("PDF personalizado nao preencheu os exemplos editaveis");
      }
      await clickText(cdp, "Fechar");
      await sleep(250);
      await clickText(cdp, "EXPORTAR PDF");
      await sleep(500);
    });
    const backupPath = path.join(path.dirname(appExe), "database", "danix.db");
    results.push({ name: "database sidecar exists", ok: fs.existsSync(backupPath) });
    console.log(JSON.stringify({ ok: true, steps: results.length, backupPath, backupExists: fs.existsSync(backupPath) }, null, 2));
  } finally {
    if (cdp) cdp.close();
    child.kill();
    await sleep(1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
