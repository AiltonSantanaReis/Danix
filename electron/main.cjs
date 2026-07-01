const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");

let mainWindow = null;
let nextServerStarted = false;
let nextServerProcess = null;
let selectedAppPort = null;

const DEFAULT_APP_PORT = Number(process.env.APP_PORT || "3678");
const isDev = process.env.ELECTRON_DEV === "1";

function writeStartupLog(message, error) {
  try {
    const logPath = path.join(app.getPath("userData"), "startup.log");
    const details = error ? `\n${error.stack || error.message || String(error)}` : "";
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${details}\n`);
  } catch {
    // Startup logging must never block the app from opening.
  }
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  writeStartupLog(
    "console.error",
    args.map((arg) => (arg instanceof Error ? arg.stack || arg.message : String(arg))).join(" ")
  );
  originalConsoleError(...args);
};

process.on("uncaughtException", (error) => {
  writeStartupLog("Uncaught exception in main process", error);
  throw error;
});

process.on("unhandledRejection", (error) => {
  writeStartupLog("Unhandled rejection in main process", error);
});

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort) {
  const firstPort = Number.isInteger(preferredPort) && preferredPort > 0 ? preferredPort : 3678;

  for (let port = firstPort; port < firstPort + 100; port += 1) {
    if (await canListenOnPort(port)) {
      return String(port);
    }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(String(address.port));
          return;
        }

        reject(new Error("Could not resolve an available local port."));
      });
    });

    server.listen(0, "127.0.0.1");
  });
}

function getPortableDatabaseDir() {
  const binaryDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  return path.join(binaryDir, "database");
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const request = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timeout while waiting for local server."));
          return;
        }
        setTimeout(check, 500);
      });
    };

    check();
  });
}

function startLocalNextServer(port) {
  if (isDev) {
    return null;
  }

  if (nextServerStarted) {
    return null;
  }

  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(app.getAppPath(), ".next", "standalone");
  const standaloneServer = path.join(standaloneDir, "server.js");
  const nodeExecutable = app.isPackaged
    ? path.join(process.resourcesPath, "node", "node.exe")
    : process.execPath;
  const serverEnv = { ...process.env };
  delete serverEnv.ELECTRON_RUN_AS_NODE;

  const portableDatabaseDir = getPortableDatabaseDir();
  fs.mkdirSync(portableDatabaseDir, { recursive: true });

  writeStartupLog(`Starting local Next server with ${nodeExecutable} from ${standaloneServer} on port ${port}`);
  nextServerProcess = spawn(nodeExecutable, ["--preserve-symlinks", "--preserve-symlinks-main", standaloneServer], {
    cwd: standaloneDir,
    env: {
      ...serverEnv,
      NODE_ENV: "production",
      APP_DATA_DIR: app.getPath("userData"),
      BACKUP_DATABASE_DIR: portableDatabaseDir,
      HOSTNAME: "127.0.0.1",
      PORT: port,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextServerProcess.stdout?.on("data", (chunk) => {
    writeStartupLog(`Local Next server stdout: ${String(chunk).trim()}`);
  });

  nextServerProcess.stderr?.on("data", (chunk) => {
    writeStartupLog(`Local Next server stderr: ${String(chunk).trim()}`);
  });

  nextServerProcess.on("error", (error) => {
    writeStartupLog("Failed to spawn local Next server", error);
  });

  nextServerProcess.on("exit", (code, signal) => {
    writeStartupLog(`Local Next server exited with code ${code ?? "null"} and signal ${signal ?? "null"}`);
    nextServerStarted = false;
    nextServerProcess = null;
  });

  nextServerStarted = true;
  return nextServerProcess;
}

async function createWindow() {
  if (!isDev && !selectedAppPort) {
    selectedAppPort = await findAvailablePort(DEFAULT_APP_PORT);
    if (selectedAppPort !== String(DEFAULT_APP_PORT)) {
      writeStartupLog(`Port ${DEFAULT_APP_PORT} is unavailable. Using ${selectedAppPort}.`);
    }
  }

  const url = isDev ? "http://localhost:3000" : `http://127.0.0.1:${selectedAppPort}`;
  const appIcon = app.isPackaged
    ? path.join(process.resourcesPath, "Danix.ico")
    : path.join(app.getAppPath(), "Danix.ico");

  if (!isDev) {
    startLocalNextServer(selectedAppPort);
    try {
      await waitForServer(url);
      writeStartupLog(`Local Next server ready at ${url}`);
    } catch (error) {
      writeStartupLog(`Local Next server did not become ready at ${url}`, error);
      throw error;
    }
  }

  mainWindow = new BrowserWindow({
    title: "Danix",
    width: 1500,
    height: 950,
    minWidth: 1200,
    minHeight: 760,
    icon: appIcon,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
