const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceModules = path.join(root, "node_modules");
const standaloneModules = path.join(root, ".next", "standalone", "node_modules");
const rootPackage = require(path.join(root, "package.json"));

const copied = new Set();
const queued = [];

function packageDir(packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(sourceModules, scope, name);
  }

  return path.join(sourceModules, packageName);
}

function targetDir(packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(standaloneModules, scope, name);
  }

  return path.join(standaloneModules, packageName);
}

function enqueue(packageName) {
  if (!packageName || copied.has(packageName) || queued.includes(packageName)) {
    return;
  }

  if (fs.existsSync(packageDir(packageName))) {
    queued.push(packageName);
  }
}

function dependencyNames(packageJson) {
  return [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}).filter((name) => fs.existsSync(packageDir(name))),
  ];
}

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);

    if (source.includes(`${path.sep}.cache${path.sep}`)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(source, destination);
      continue;
    }

    if (entry.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(source);
      fs.symlinkSync(linkTarget, destination);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(source, destination);
    }
  }
}

function copyPackage(packageName) {
  const from = packageDir(packageName);
  const to = targetDir(packageName);

  if (!fs.existsSync(from)) {
    return;
  }

  fs.rmSync(to, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  copyDirectory(from, to);

  copied.add(packageName);

  const packageJsonPath = path.join(from, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    dependencyNames(packageJson).forEach(enqueue);
  }
}

fs.mkdirSync(standaloneModules, { recursive: true });
Object.keys(rootPackage.dependencies || {}).forEach(enqueue);

while (queued.length > 0) {
  copyPackage(queued.shift());
}

console.log(`Standalone dependencies prepared: ${copied.size} packages copied.`);
