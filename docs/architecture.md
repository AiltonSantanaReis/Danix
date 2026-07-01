# Architecture

## Overview

Danix is an offline-first Windows desktop application built with Electron + Next.js.

Runtime flow:

1. `Danix.exe` starts Electron.
2. Electron starts a local Node process.
3. Node runs the Next.js standalone server at `127.0.0.1`.
4. Electron loads the selected local port (prefers `3678`, uses fallback if busy).

## Main Components

- UI and pages: `src/app/`
- Internal API routes: `src/app/api/*/route.ts`
- Database layer: `src/db/index.ts`, `src/db/schema.ts`
- Desktop host/runtime: `electron/main.cjs`
- Packaging: `build-portable.cmd`, `scripts/prepare-standalone.cjs`

## Data Model

Main local entities:

- users, sessions, admin_events
- properties, expenses, sales, suppliers
- payables, invoices, employees, receivables, budgets

## Data Ownership

- Main database: `%AppData%\\Danix\\danix.db`
- Synchronized copy: `<Danix folder>\\database\\danix.db`
- Source dev DB (optional): `local-data/danix.db`

## Packaging Model

The source repository stays clean. Runtime artifacts are generated only during build and distributed in Releases as `Danix-Portable.zip`.
