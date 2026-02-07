# Share

A desktop application for fair item distribution among participants. Share manages users, objects (with types and parts), and distributions, applying fairness algorithms to assign items based on historical allocation patterns.

## Tech Stack

- **Electron 38** + **Vite 7** + **React 19** + **TypeScript**
- **Tailwind CSS 4** for styling
- **SQLite** via **Prisma ORM** for data persistence
- **Recharts** for statistics and visualizations
- **jsPDF** for PDF export

## Features

- **User management** - Add, edit, and delete participants
- **Object management** - Define objects with types and parts (e.g., a pizza with types like Margherita, each composed of parts/slices)
- **Fair distribution** - Create distributions that assign items to participants using configurable fairness algorithms
- **Algorithm options** - `random`, `less`, `share_less` (default), `share_random`
- **History tracking** - Past distributions inform future allocations for long-term fairness
- **Statistics** - Visual charts showing distribution history and allocation patterns
- **PDF export** - Generate distribution recap reports

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm

### Installation

```bash
npm install
npx prisma generate
```

### Development

```bash
npm start
```

### Build

```bash
npm run package    # Package the application
npm run make       # Build distributable packages (Windows/macOS/Linux)
```

### Other Commands

```bash
npm run lint       # Run ESLint
npm run studio     # Open Prisma Studio for database inspection
```

## Project Structure

```
src/
  main.ts              # Electron main process
  preload.ts           # Context bridge (window.api)
  renderer.tsx         # React entry point
  settings.ts          # App settings management
  ipc/                 # IPC handlers by domain
    app.ts
    users.ts
    objects.ts
    distributions.ts   # Distribution algorithm
    settings.ts
  components/
    home/              # Distribution creation
    recap/             # Distribution recap & PDF export
    stats/             # Statistics & charts
    settings/          # User, object, and algorithm settings
    navbar/
    layout/
    shared/
prisma/
  schema.prisma        # Database schema
```

## License

MIT
