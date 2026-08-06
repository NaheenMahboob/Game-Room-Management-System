# Game Room Management System

Community game room management for a local mosque: member registration (desk + self-service with photo verification), attendance (sign-in/sign-out), per-unit equipment loans, guest passes, a TV-friendly public status board, a member self-service portal, and a tablet-first volunteer/admin dashboard with offline PWA support.

## Table of contents

- [What this README covers](#what-this-readme-covers)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Role / permission matrix](#role--permission-matrix)
- [Internationalization](#internationalization)
- [Offline PWA](#offline-pwa)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Status](#status)

## What this README covers

Good project READMEs usually include a short pitch, features, stack, setup, usage, config, structure, contributing, and license. This repo also requires a few domain-specific sections. Together:

| Section | Why |
|---------|-----|
| Description / pitch | What it is and who it’s for |
| Features | What you can do with it |
| Tech stack | How it’s built |
| Prerequisites + getting started | Clone, install, env, migrate, seed, run |
| Configuration | Environment variables and scripts |
| Usage | How to open each surface and sign in |
| Project structure | Where code lives |
| Role / permission matrix | Who can do what |
| Internationalization | How to add languages |
| Deployment | How to ship to production |
| Troubleshooting | Common local failures |
| Contributing | How to propose changes |
| License / status | Ownership and maturity |

Keep these current when behavior or setup changes.

## Features

- **Public status board** — occupancy and per-unit equipment availability for a wall / TV display
- **Member portal** — self-register (email format + MX / disposable checks; no outbound mail), “I’m here” check-in request, profile + photo, QR membership card, visit/loan history, announcements
- **Volunteer kiosk** — waiting-to-enter list, QR sign-in & sign-out, desk registration (same email domain checks when an address is entered), borrow/return, guest passes, pending photo approvals, shift checklist
- **Admin suite** — inventory, users, shifts, announcements/events, analytics charts, CSV reports, settings, append-only audit log
- **RBAC** — MEMBER / VOLUNTEER / ADMIN with middleware and API guards
- **Offline PWA** — volunteer dashboard queues key actions when Wi‑Fi drops
- **i18n** — English, Arabic, and Urdu catalogs with a language switcher

## Tech stack

- **App:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** Prisma ORM + PostgreSQL (Docker Compose for local)
- **Auth:** JWT (`jose`) + bcrypt, HTTP-only cookies, middleware RBAC
- **Validation:** Zod on API inputs
- **PWA:** `@ducanh2912/next-pwa` + IndexedDB offline action queue
- **i18n:** `next-intl` — English, Arabic, Urdu message catalogs
- **UI extras:** `recharts` (analytics), `html5-qrcode` / `qrcode.react` (QR)
- **Deploy targets:** Vercel (or any Node host) + hosted Postgres

## Prerequisites

- Node.js 20+
- Docker Desktop (local Postgres)
- Git

## Getting started

```bash
git clone https://github.com/NaheenMahboob/Game-Room-Management-System.git
cd Game-Room-Management-System

npm install

npm run db:up

cp .env.example .env
# Edit .env — at minimum set JWT_SECRET (≥ 32 chars) and seed account passwords

npx prisma migrate deploy
npx prisma generate
npm run db:seed

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Prisma Client is generated into `src/generated/prisma` (gitignored). `postinstall` / `build` also run `prisma generate`.

## Configuration

### Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | ≥ 32 characters; never commit real secrets |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed | Bootstrap admin (+ member profile). Only this account may change other ADMIN roles. |
| `VOLUNTEER_EMAIL` / `VOLUNTEER_PASSWORD` | seed | Demo volunteer |
| `MEMBER_EMAIL` / `MEMBER_PASSWORD` | seed | Demo member |
| `EMAIL_MX_CHECK` | no | Set `false` to skip MX DNS on self-register (offline CI). `.local` domains are always skipped. |

See [`.env.example`](.env.example) for the full template. Do not commit `.env`.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run db:up` / `db:down` | Start/stop local Postgres |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Seed admin, volunteer, member + 46 equipment items |
| `npm run db:studio` | Prisma Studio |
| `npm run db:backup` | Full backup bundle: SQL + photos + `.env` under `./backups/` |
| `npm run build` | Production build (Prisma Client + service worker) |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

### Backups (database + photos + env)

With Docker Postgres running (`npm run db:up`):

```bash
npm run db:backup
```

Creates a timestamped folder:

```text
backups/gameroom-YYYYMMDD-HHMMSS/
  database.sql          # Postgres dump
  storage/members/      # Profile photos (names match DB photoUrl)
  .env                  # Secrets — do not share or commit
  RESTORE.txt           # Short restore steps
```

Everything under `backups/` is gitignored.

**Same machine for app + DB:** local backups alone are not enough if the disk fails. After each run (or via the scheduler), copy the new `backups/gameroom-*` folder to another disk, USB, or NAS. Optional env var:

```bash
# Windows PowerShell example (USB drive)
$env:BACKUP_COPY_TO="E:\grms-backups"; npm run db:backup
```

Or set `BACKUP_COPY_TO` permanently in the Task Scheduler / cron environment.

Schedule `npm run db:backup` (from the project directory):

- **Windows** — Task Scheduler  
- **macOS** — `launchd`  
- **Linux** — cron, e.g. `0 2 * * * cd /path/to/repo && npm run db:backup`

Restore outline: put `.env` and `storage/members` back, then load `database.sql` into Postgres (see `RESTORE.txt` inside each bundle). Production can still use managed Postgres snapshots when available.

## Usage

| Surface | URL | Who |
|---------|-----|-----|
| Home / links | `/` | Anyone |
| Public board | `/public` | Anyone (TV / wall display) |
| Member portal | `/portal` | Members (and staff with a member profile) |
| Member register | `/portal/register` | New applicants |
| Volunteer dashboard | `/dashboard` | Volunteers & admins |
| Admin | `/dashboard/admin` | Admins only |

### Test accounts (after seed)

| Role | URL | Credentials |
|------|-----|-------------|
| Member | `/portal/login` | `member@mosque.local` / `ChangeMeMember123!` |
| Volunteer | `/dashboard/login` | `volunteer@mosque.local` / `ChangeMeVolunteer123!` |
| Admin | `/dashboard/login` | `admin@mosque.local` / `ChangeMeAdmin123!` |

Change these passwords before any real deployment.

## Project structure

```
├── messages/           # i18n catalogs (en, ar, ur)
├── prisma/             # schema, migrations, seed
├── public/             # static assets, PWA manifest
├── src/
│   ├── app/            # App Router pages + API routes
│   ├── components/     # UI (dashboard, portal, public, shared)
│   ├── generated/      # Prisma Client (generated, gitignored)
│   ├── i18n/           # locale config
│   ├── lib/            # auth, services, uploads, validation
│   ├── middleware.ts   # route guards
│   └── types/          # ambient type declarations
├── storage/members/    # private member photos (local disk)
├── docker-compose.yml  # local Postgres
└── .env.example        # env template
```

## Role / permission matrix

| Capability | Public | Member | Volunteer | Admin |
|------------|--------|--------|-----------|-------|
| Status board (`/public`) | yes | yes | yes | yes |
| Self-register (`/portal/register`) | yes | — | — | — |
| Own profile / QR / “I’m here” check-in / history / announcements | — | yes | yes\* | yes\* |
| Waiting-to-enter list, sign-in/out, loans, desk register, guests, checklist | — | — | yes | yes |
| Pending member photo approval queue | — | — | yes | yes |
| Inventory, users, analytics, audit, settings, shifts, content | — | — | — | yes |

\*Staff with a linked member profile can also use the member portal. Only the bootstrap admin (`ADMIN_EMAIL`) can change another ADMIN’s role; other admins may manage members/volunteers and promote to admin.

JWT cookies: `grms_access` (~1h), `grms_refresh` (~7d). Middleware guards `/portal/*`, `/dashboard/*`, and `/dashboard/admin/*`. Forced password change applies when `mustChangePassword` is set (desk register / admin reset).

## Internationalization

Default language is English. Locale is stored in the `grms_locale` cookie (no URL prefix required).

### How to add a new language

1. Copy `messages/en.json` → `messages/<code>.json`
2. Translate values (keep keys identical)
3. Add `<code>` to `locales` in [`src/i18n/config.ts`](src/i18n/config.ts)
4. Import the catalog in [`src/components/i18n/I18nProvider.tsx`](src/components/i18n/I18nProvider.tsx)
5. Add a label in [`src/components/i18n/LanguageSwitcher.tsx`](src/components/i18n/LanguageSwitcher.tsx)

## Offline PWA

- Production builds register a service worker (disabled in `next dev`)
- Installable via browser “Add to Home Screen” / install prompt (`manifest.json`)
- When offline, sign-in / sign-out / borrow / return are queued in IndexedDB (desk register is online-only)
- On reconnect, `/api/sync` replays the queue; conflicts surface as warnings for manual resolution
- Connection status chip shows Online / Offline / Syncing + queued count

## Deployment

### Vercel + hosted Postgres

1. Create a Postgres database (Neon, Supabase, Railway, etc.)
2. Import this GitHub repo into Vercel
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, and seed accounts if you will run seed
4. On first deploy (or via a one-off job): `npx prisma migrate deploy`, then optionally `npx prisma db seed`
5. Build command: `npm run build` (Next.js default output)

### Any Node.js host

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start
```

Serve over HTTPS behind a reverse proxy (Caddy/Nginx) on port 3000. Local Postgres can use [`docker-compose.yml`](docker-compose.yml); production should use managed Postgres with backups.

### Production checklist

- [ ] Rotate `JWT_SECRET` (not the example value)
- [ ] Use managed Postgres with backups
- [ ] Run `prisma migrate deploy` before first traffic
- [ ] Change default admin / volunteer / member passwords
- [ ] Confirm the volunteer tablet can install the PWA over HTTPS
- [ ] Confirm `storage/members/` (or your photo storage) is writable and not publicly browsable

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| `Can't reach database` | `npm run db:up`, confirm `DATABASE_URL`, wait for Postgres healthy |
| Prisma Client missing / import errors | `npx prisma generate` |
| Schema out of date | `npx prisma migrate deploy` (or `npm run db:migrate` in dev) |
| Seed accounts missing | `npm run db:seed` |
| Photos 404 | Ensure `storage/members/` exists and files were written; restart after first upload |
| PWA / offline not active | Use `npm run build && npm run start` over HTTPS (or localhost); SW is off in `next dev` |
| Login locked out | Wait for rate-limit window, or have an admin reset the password (clears related limits) |

## Contributing

This is a private community deployment repo. If you have access and want to change something:

1. Create a branch from `main`
2. Keep changes focused; match existing TypeScript / Tailwind patterns
3. Add or update module-level TSDoc on new `src/**/*.ts` exports
4. Run `npm run lint` and smoke-test the affected portal (public / portal / dashboard)
5. Open a pull request describing why the change is needed

Do not commit `.env`, real secrets, or generated Prisma Client under `src/generated/`.

## License

No public license file is published yet. Treat the code as proprietary to the mosque community project unless a `LICENSE` is added later.

## Status

Modules 1–7 are complete: schema/seed, auth/RBAC, core APIs, volunteer kiosk, public + member portals, admin suite, i18n + offline PWA + deploy docs. TypeScript under `src/**/*.ts` uses module-level TSDoc on functions and declarations.
