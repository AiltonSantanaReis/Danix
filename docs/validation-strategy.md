# Validation Strategy

Danix validation combines static checks, build checks, and packaged-app checks.

## Core Checks

```cmd
npm run typecheck
npm run lint
npm run build
```

## Packaging Check

```cmd
build-portable.cmd
```

## Runtime Smoke Checks

```cmd
npm run smoke:api
npm run smoke:backup
npm run smoke:crud
npm run smoke:security
npm run smoke:ui
```

## Visual Capture Checks

```cmd
npm run visual:dashboard
npm run visual:popups
npm run visual:user-security
```

## Why This Matters

Desktop packaging failures can appear only in the packaged runtime, not during browser-only development. Validation must include the generated desktop output.
