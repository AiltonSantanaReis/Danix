# Build Windows

## Development Requirements

- Node.js 20 LTS or newer
- npm
- Windows 10/11 for desktop packaging

## Development Commands

```cmd
npm install
npm run dev
npm run build
```

## Portable Build

```cmd
build-portable.cmd
```

Build process summary:

1. Runs `next build --webpack`.
2. Prepares standalone runtime dependencies.
3. Copies static/public assets to standalone.
4. Runs `electron-builder`.
5. Copies standalone output to `dist-portable-ready/win-unpacked/resources/standalone`.
6. Copies the current Node runtime as `resources/node/node.exe`.
7. Generates `dist-portable-ready/Danix-Portable.zip`.

## Distribution Rule

- GitHub repository: source code only.
- GitHub Releases: complete client package (`Danix-Portable.zip`).
- End user: extract ZIP and run `Danix.exe`.
