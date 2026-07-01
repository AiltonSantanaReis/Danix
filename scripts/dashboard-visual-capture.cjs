const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { WebSocket } = require("undici");

const root = path.resolve(__dirname, "..");
const appExe = path.join(root, "dist-portable-ready", "win-unpacked", "Danix.exe");
const tmpRoot = path.join(root, "tmp-dashboard-captures");
const appData = path.join(tmpRoot, "appdata");
const userDataDir = path.join(tmpRoot, "chromium");
const outputDir = path.join(tmpRoot, "screenshots");
const port = Number(process.env.DASHBOARD_CAPTURE_DEBUG_PORT || 9231);
const appPort = Number(process.env.DASHBOARD_CAPTURE_APP_PORT || 4691);
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
      // Electron is still starting.
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

  window.__danixCapture = {
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
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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
    setTheme(theme) {
      const select = document.querySelector('select[aria-label="Tema do aplicativo"]');
      if (!select) throw new Error("Theme selector not found");
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, theme);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    async postJson(url, payload) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(url + " failed: " + JSON.stringify(data));
      return data;
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
    `window.__danixCapture.elementCenterByText(${JSON.stringify(text)}, ${JSON.stringify(selector || "button,a,label,[role=button]")})`
  );
  if (!center) throw new Error(`Clickable text not found: ${text}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await sleep(250);
}

async function fill(cdp, label, value) {
  await evaluate(cdp, `window.__danixCapture.fillLabeled(${JSON.stringify(label)}, ${JSON.stringify(value)})`);
  await sleep(50);
}

async function waitForText(cdp, text, timeoutMs = 12000) {
  const start = Date.now();
  let lastText = "";
  while (Date.now() - start < timeoutMs) {
    lastText = await evaluate(cdp, "window.__danixCapture.visibleText()");
    if (lastText.includes(text)) return;
    await sleep(250);
  }
  fs.writeFileSync(path.join(tmpRoot, "last-visible-text.txt"), lastText);
  throw new Error(`Text not found after wait: ${text}. Visible text saved to ${path.join(tmpRoot, "last-visible-text.txt")}`);
}

async function capture(cdp, fileName) {
  await sleep(600);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(screenshot.data, "base64"));
  console.log(`CAPTURE ${filePath}`);
}

async function seedDashboardData(cdp) {
  await evaluate(
    cdp,
    `(async () => {
      const property = await window.__danixCapture.postJson('/api/properties', {
        name: 'Residencial Aurora - Captura',
        address: 'Rua das Amostras, 120',
        purchaseDate: '2026-06-01',
        purchasePrice: 0,
        currentValue: 0,
        status: 'under_reform'
      });

      const supplier = await window.__danixCapture.postJson('/api/suppliers', {
        propertyId: property.id,
        legalName: 'Construtora Visual Ltda',
        tradeName: 'Construtora Visual',
        cnpj: '00.000.000/0001-00',
        phone: '(11) 90000-0000',
        email: '',
        category: 'Materiais',
        status: 'open',
        observation: 'Fornecedor usado apenas para captura automatizada'
      });

      await window.__danixCapture.postJson('/api/expenses', {
        propertyId: property.id,
        category: 'Reforma',
        item: 'Pintura e acabamento',
        amount: 1850.75,
        purchaseDate: '2026-06-10',
        invoiceNumber: 'CAP-001',
        invoiceDate: '',
        description: 'Despesa usada para capturar dashboard com dados'
      });

      await window.__danixCapture.postJson('/api/expenses', {
        propertyId: property.id,
        category: 'Materiais',
        item: 'Porcelanato',
        amount: 3240.2,
        purchaseDate: '2026-06-12',
        invoiceNumber: 'CAP-002',
        invoiceDate: '',
        description: ''
      });

      await window.__danixCapture.postJson('/api/payables', {
        propertyId: property.id,
        supplierId: supplier.id,
        supplierName: 'Construtora Visual',
        product: 'Entrada de materiais',
        services: '',
        purchaseDate: '2026-06-13',
        amount: 980.5,
        invoiceDate: '',
        invoiceNumber: 'BOL-001',
        paymentMethod: 'Boleto',
        dueDate: '2026-06-25',
        status: 'open',
        observation: '',
        installmentNumber: 1,
        installmentTotal: 2
      });

      await window.__danixCapture.postJson('/api/payables', {
        propertyId: property.id,
        supplierId: supplier.id,
        supplierName: 'Construtora Visual',
        product: 'Parcela paga',
        services: '',
        purchaseDate: '2026-06-05',
        amount: 720,
        invoiceDate: '',
        invoiceNumber: 'BOL-002',
        paymentMethod: 'Pix',
        dueDate: '2026-06-08',
        status: 'paid',
        observation: '',
        installmentNumber: 2,
        installmentTotal: 2
      });

      await window.__danixCapture.postJson('/api/payables', {
        propertyId: property.id,
        supplierId: supplier.id,
        supplierName: 'Construtora Visual',
        product: 'Conta atrasada de teste visual',
        services: '',
        purchaseDate: '2026-05-20',
        amount: 430,
        invoiceDate: '',
        invoiceNumber: 'BOL-003',
        paymentMethod: 'Boleto',
        dueDate: '2026-05-30',
        status: 'overdue',
        observation: '',
        installmentNumber: null,
        installmentTotal: null
      });
    })()`
  );
}

async function main() {
  if (!fs.existsSync(appExe)) {
    throw new Error(`Portable executable not found: ${appExe}`);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(appData, { recursive: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

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

  try {
    const webSocketUrl = await waitForDebugger();
    cdp = connectCdp(webSocketUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, expressionSource);

    await waitForText(cdp, "Criar administrador");
    await fill(cdp, "USUARIO", "admin");
    await fill(cdp, "NOME", "Admin Captura Visual");
    await fill(cdp, "SENHA", "Admin123!");
    await clickText(cdp, "Criar administrador");
    await waitForText(cdp, "Total de Gastos");

    await evaluate(cdp, `window.__danixCapture.setTheme('light-blue')`);
    await capture(cdp, "dashboard-empty-light.png");

    await evaluate(cdp, `window.__danixCapture.setTheme('dark')`);
    await capture(cdp, "dashboard-empty-dark.png");

    await seedDashboardData(cdp);
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(1200);
    await evaluate(cdp, expressionSource);
    await waitForText(cdp, "Total de Gastos");

    await evaluate(cdp, `window.__danixCapture.setTheme('light-blue')`);
    await waitForText(cdp, "Pintura");
    await capture(cdp, "dashboard-populated-light.png");

    await evaluate(cdp, `window.__danixCapture.setTheme('dark')`);
    await capture(cdp, "dashboard-populated-dark.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await capture(cdp, "dashboard-populated-compact-1100.png");

    const files = fs.readdirSync(outputDir).filter((file) => file.endsWith(".png"));
    if (files.length !== 5) {
      throw new Error(`Expected 5 dashboard screenshots, got ${files.length}`);
    }

    console.log(JSON.stringify({ ok: true, outputDir, files }, null, 2));
  } finally {
    if (cdp) cdp.close();
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
