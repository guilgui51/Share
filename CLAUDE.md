# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Share** is an Electron desktop app for fair item distribution among participants. It manages users, objects (with types and parts), and distributions, applying fairness algorithms to assign items based on historical allocation patterns.

**Stack:** Electron 38 + Vite 7 + React 19 + TypeScript + Tailwind CSS 4 + SQLite (Prisma ORM) + Recharts

## Commands

```bash
npm start              # Launch app in dev mode (electron-forge start)
npm run package        # Package the application
npm run make           # Build distributable packages
npm run lint           # ESLint on .ts/.tsx files
npm run studio         # Open Prisma Studio for database inspection
```

No test framework is configured.

## Architecture

### Electron Process Model

- **Main process** (`src/main.ts`): App lifecycle, window creation, IPC handler registration. Uses `dev.db` in development, copies `app.db` to userData in production.
- **Preload** (`src/preload.ts`): Context bridge exposing `window.api` object. Dynamically builds typed API from `IpcChannels`.
- **Renderer** (`src/renderer.tsx`): React app using HashRouter.

### IPC Communication

All IPC is strongly typed through a union type `IpcChannels` defined in `src/ipc/index.ts`. Handlers are organized by domain:

| Module | Channels |
|---|---|
| `src/ipc/app.ts` | `app:exit` |
| `src/ipc/users.ts` | `users:getAll`, `users:add`, `users:edit`, `users:delete` |
| `src/ipc/objects.ts` | `objects:getAll`, `objects:add`, `objects:edit`, `objects:delete` |
| `src/ipc/distributions.ts` | `distributions:getAll`, `distributions:create`, `distributions:cancel` |
| `src/ipc/settings.ts` | `settings:get`, `settings:update` |

Renderer calls: `await window.api["channel:name"](args)`

### Database (Prisma + SQLite)

Schema in `prisma/schema.prisma`. Client initialized in `prisma/index.ts` with datasource URL override for dev/prod.

Key models: `User`, `Object` → `Type` → `Part`, `Distribution` with junction tables `DistributionUser`, `DistributionSelection`, and `Assignment`.

### Distribution Algorithm

Located in `src/ipc/distributions.ts`. Three-phase process:
1. **Plan:** Determine item count per participant
2. **Preferences:** Build per-user part preferences using historical fairness data (`buildUserPartTotals()`)
3. **Optimize:** Assign parts based on plan + preferences

Four algorithm types (configured in settings): `random`, `less`, `share_less` (default), `share_random`.

### Settings

`src/settings.ts` reads/writes `settings.json` in Electron's userData directory. Defaults: `{ algorithmType: "share_less", algorithmCount: 0 }`.

### Global Types

`forge.env.d.ts` defines shared TypeScript interfaces: `User`, `UserFormData`, `ObjectFormData`, `DistributionCreatePayload`, `AppSettings`, `DistributionCardDTO`.

### Routes

`/` (Home/distribution creation), `/recap`, `/statistics`, `/settings/users`, `/settings/pieces`, `/settings/algorithm`

## Build & Packaging

Electron Forge config in `forge.config.ts`. A `prePackage` hook copies the Prisma client to `node_modules_copy/` for bundling. Production database (`prisma/app.db`) is included as an extra resource.

Makers: Squirrel (Windows), ZIP (macOS), RPM/DEB (Linux).
