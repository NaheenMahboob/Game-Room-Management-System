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

## Auth (Module 2)

| Portal | URL | Test account |
|--------|-----|--------------|
| Member | `/portal/login` | `member@mosque.local` / `ChangeMeMember123!` |
| Dashboard | `/dashboard/login` | `volunteer@mosque.local` / `ChangeMeVolunteer123!` |
| Admin | `/dashboard/login` then `/dashboard/admin` | `admin@mosque.local` / `ChangeMeAdmin123!` |

JWT session cookies: `grms_access` (1h), `grms_refresh` (7d). Middleware guards `/portal/*`, `/dashboard/*`, and `/dashboard/admin/*`.

## Core APIs (Module 3)

Staff-only (VOLUNTEER/ADMIN) unless noted:

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/members` | Search / register |
| GET/PATCH | `/api/members/[id]` | Profile (members: self only) |
| GET | `/api/members/by-qr/[payload]` | QR lookup |
| POST | `/api/attendance/sign-in` | Room sign-in |
| POST | `/api/attendance/sign-out` | Sign-out (+ force return loans) |
| GET | `/api/attendance` | History / `?active=true` |
| GET | `/api/equipment` | Inventory + loan/queue state |
| PATCH | `/api/equipment/[id]/condition` | Condition update |
| GET/POST | `/api/loans` | Active loans / borrow |
| POST | `/api/loans/return` | Return one/all |
| GET/POST/DELETE | `/api/queue` | Waiting queue |
| POST | `/api/guests` | Issue guest pass |
| POST/DELETE | `/api/guests/[id]` | Guest sign-in / sign-out |
| GET | `/api/admin/audit` | Audit log (ADMIN) |
| GET | `/api/public/occupancy` | Public occupancy |
| GET | `/api/public/availability` | Public equipment counts |

## Project status

Modules 1–3 complete. Next: volunteer tablet UI (Module 4).
