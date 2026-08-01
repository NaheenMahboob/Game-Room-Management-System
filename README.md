# Game Room Management System

Community game room management for a local mosque: member registration, attendance, equipment loans, public status board, and volunteer/admin dashboard.

## Tech stack (Module 1)

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL
- Docker Compose for local database

## Local setup

### Prerequisites

- Node.js 20+ (18+ also works)
- Docker Desktop

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
npm run db:up
```

### 3. Configure environment

Copy `.env.example` to `.env` (already present after Module 1 setup):

```env
DATABASE_URL="postgresql://gameroom:gameroom@localhost:5432/gameroom?schema=public"
JWT_SECRET="change-me-to-a-long-random-string"
ADMIN_EMAIL="admin@mosque.local"
ADMIN_PASSWORD="ChangeMeAdmin123!"
```

### 4. Migrate and seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

Seed creates:

- One admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- All 46 equipment items
- Default settings (opening hours, session limits, guest limit)
- Waiver version 1
- Sample announcement and event

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the home page shows DB connection status and equipment count.

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run db:up` | Start Postgres container |
| `npm run db:down` | Stop Postgres container |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed admin + inventory |
| `npm run db:studio` | Open Prisma Studio |
| `npm run dev` | Start Next.js dev server |

## Project status

Module 1 (schema, database, seeding) is complete. Auth, APIs, and UI modules follow next.
