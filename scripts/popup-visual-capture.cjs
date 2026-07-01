const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { WebSocket } = require("undici");

const root = path.resolve(__dirname, "..");
const appExe = path.join(root, "dist-portable-ready", "win-unpacked", "Danix.exe");
const tmpRoot = path.join(root, "tmp-popup-captures");
const appData = path.join(tmpRoot, "appdata");
const userDataDir = path.join(tmpRoot, "chromium");
const outputDir = path.join(tmpRoot, "screenshots");
const debugPort = Number(process.env.POPUP_CAPTURE_DEBUG_PORT || 9241);
const appPort = Number(process.env.POPUP_CAPTURE_APP_PORT || 4701);
const baseDebugUrl = `http://127.0.0.1:${debugPort}`;

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
  for (let index = 0; index < 90; index += 1) {
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

  window.__danixPopupCapture = {
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
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: element.innerText || element.textContent || "" };
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
    modalMetrics() {
      const cards = Array.from(document.querySelectorAll(".data-form-card")).filter(visible);
      const card = cards[0];
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollY: Math.round(window.scrollY),
        className: card.className,
      };
    },
    closeVisibleModal() {
      const cards = Array.from(document.querySelectorAll(".data-form-card")).filter(visible);
      const card = cards[0];
      if (!card) return false;
      const closeButton = Array.from(card.querySelectorAll("button")).find((button) => normalize(button.innerText || button.textContent).includes("fechar"));
      if (!closeButton) return false;
      closeButton.click();
      return true;
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
    `window.__danixPopupCapture.elementCenterByText(${JSON.stringify(text)}, ${JSON.stringify(selector || "button,a,label,[role=button]")})`
  );
  if (!center) throw new Error(`Clickable text not found: ${text}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: center.x, y: center.y, button: "left", clickCount: 1 });
  await sleep(300);
}

async function fill(cdp, label, value) {
  await evaluate(cdp, `window.__danixPopupCapture.fillLabeled(${JSON.stringify(label)}, ${JSON.stringify(value)})`);
  await sleep(50);
}

async function waitForText(cdp, text, timeoutMs = 14000) {
  const start = Date.now();
  let lastText = "";
  while (Date.now() - start < timeoutMs) {
    lastText = await evaluate(cdp, "window.__danixPopupCapture.visibleText()");
    if (lastText.includes(text)) return;
    await sleep(250);
  }
  fs.writeFileSync(path.join(tmpRoot, "last-visible-text.txt"), lastText);
  throw new Error(`Text not found after wait: ${text}`);
}

async function captureModal(cdp, name) {
  await sleep(500);
  const metrics = await evaluate(cdp, "window.__danixPopupCapture.modalMetrics()");
  if (!metrics) throw new Error(`Popup metrics not found for ${name}`);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const filePath = path.join(outputDir, `${name}.png`);
  fs.writeFileSync(filePath, Buffer.from(screenshot.data, "base64"));
  console.log(`CAPTURE ${filePath}`);
  return { name, file: filePath, metrics };
}

async function closeModal(cdp) {
  await evaluate(cdp, "window.__danixPopupCapture.closeVisibleModal()");
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const metrics = await evaluate(cdp, "window.__danixPopupCapture.modalMetrics()");
    if (!metrics) return;
    await sleep(100);
  }
  throw new Error("Popup did not close after clicking Fechar");
}

async function openTab(cdp, tab) {
  await clickText(cdp, tab, ".app-sidebar button,button,a,[role=button]");
  await sleep(450);
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

  const child = spawn(appExe, [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`], {
    cwd: path.dirname(appExe),
    env,
    windowsHide: true,
    stdio: "ignore",
  });

  let cdp;
  const captures = [];

  try {
    const webSocketUrl = await waitForDebugger();
    cdp = connectCdp(webSocketUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
    await evaluate(cdp, expressionSource);

    await waitForText(cdp, "Criar administrador");
    await fill(cdp, "USUARIO", "admin");
    await fill(cdp, "NOME", "Admin Captura Popup");
    await fill(cdp, "SENHA", "Admin123!");
    await clickText(cdp, "Criar administrador");
    await waitForText(cdp, "Total de Gastos");
    await evaluate(cdp, "window.__danixPopupCapture.setTheme('light-blue')");
    await sleep(500);

    const scenarios = [
      { name: "imoveis", tab: "Imoveis", opener: "NOVO IM" },
      { name: "despesas", tab: "Despesas", opener: "Adicionar" },
      { name: "vendas", tab: "Vendas", opener: "Adicionar" },
      { name: "fornecedores", tab: "Fornecedores", opener: "Adicionar" },
      { name: "contas-a-pagar", tab: "Contas a Pagar", opener: "ADICIONAR" },
      { name: "contas-a-receber", tab: "Contas a Receber", opener: "Adicionar" },
      { name: "notas-fiscais", tab: "Notas Fiscais", opener: "Adicionar" },
      { name: "funcionarios", tab: "Funcionarios", opener: "Adicionar" },
      { name: "orcamentos", tab: "Orcamentos", opener: "Adicionar" },
      { name: "pdf-personalizado", tab: "Contas a Pagar", opener: "PDF PERSONALIZADO" },
    ];

    for (const scenario of scenarios) {
      await openTab(cdp, scenario.tab);
      await clickText(cdp, scenario.opener);
      captures.push(await captureModal(cdp, scenario.name));
      await closeModal(cdp);
    }

    const metricsPath = path.join(tmpRoot, "popup-metrics.json");
    fs.writeFileSync(metricsPath, JSON.stringify(captures, null, 2));
    console.log(JSON.stringify({ ok: true, metricsPath, outputDir, captures: captures.length }, null, 2));
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
