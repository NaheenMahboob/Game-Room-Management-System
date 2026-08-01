# Game Room Management System

Community game room management for a local mosque: member registration, attendance, equipment loans, public status board, and volunteer/admin dashboard.

## Tech stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL
- JWT auth (`jose` + bcrypt), HTTP-only cookies
- PWA (`@ducanh2912/next-pwa`) with offline action queue
- i18n (`next-intl`) — English, Arabic, Urdu message catalogs
- Charts (`recharts`), QR (`html5-qrcode`, `qrcode.react`)

## Local setup

### Prerequisites

- Node.js 20+
- Docker Desktop

### Steps

```bash
npm install
npm run db:up
cp .env.example .env   # then edit secrets
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | ≥ 32 chars; change for production |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed | Bootstrap admin |
| `VOLUNTEER_*` / `MEMBER_*` | seed | Demo accounts |

### Useful scripts

| Script | Description |
|--------|-------------|
| `npm run db:up` / `db:down` | Start/stop Postgres |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | Seed admin + 46 equipment items |
| `npm run db:studio` | Prisma Studio |
| `npm run build` | Production build (generates service worker) |
| `npm run start` | Run production server |

## Role / permission matrix

| Capability | Public | Member | Volunteer | Admin |
|------------|--------|--------|-----------|-------|
| Status board | yes | yes | yes | yes |
| Own profile / history | — | yes | — | — |
| Sign-in/out, loans, register | — | — | yes | yes |
| Inventory / users / analytics / audit / settings | — | — | — | yes |

### Test accounts (after seed)

| Role | URL | Credentials |
|------|-----|-------------|
| Member | `/portal/login` | `member@mosque.local` / `ChangeMeMember123!` |
| Volunteer | `/dashboard/login` | `volunteer@mosque.local` / `ChangeMeVolunteer123!` |
| Admin | `/dashboard/login` | `admin@mosque.local` / `ChangeMeAdmin123!` |

## Feature map

- **Public board** `/public` — live occupancy & equipment (12s polling)
- **Member portal** `/portal` — profile, QR card, history, announcements
- **Volunteer kiosk** `/dashboard` — search/QR, register, borrow/return, guests, checklist
- **Admin** `/dashboard/admin` — analytics, inventory, users, shifts, content, settings, audit

## i18n (adding a language)

1. Copy `messages/en.json` → `messages/<code>.json`
2. Translate values (keep keys identical)
3. Add `<code>` to `locales` in [`src/i18n/config.ts`](src/i18n/config.ts)
4. Import the catalog in [`src/components/i18n/I18nProvider.tsx`](src/components/i18n/I18nProvider.tsx)
5. Add a label in [`src/components/i18n/LanguageSwitcher.tsx`](src/components/i18n/LanguageSwitcher.tsx)

No route changes required — locale is stored in the `grms_locale` cookie.

## Offline PWA (volunteer dashboard)

- Production builds register a service worker (disabled in `next dev`)
- Installable via browser “Add to Home Screen” / install prompt (`manifest.json`)
- When offline, sign-in / sign-out / borrow / return / register are queued in IndexedDB
- On reconnect, `/api/sync` replays the queue; conflicts (e.g. item already borrowed) surface as warnings for manual resolution
- Connection status chip shows Online / Offline / Syncing + queued count

## Deployment

### Vercel + hosted Postgres

1. Create a Postgres database (Neon, Supabase, Railway, etc.)
2. Push schema: `npx prisma migrate deploy`
3. Seed once: `npx prisma db seed` (set env vars in the host first)
4. Import the GitHub repo into Vercel
5. Set env vars: `DATABASE_URL`, `JWT_SECRET` (strong random), admin seed vars if needed
6. Deploy — build command `npm run build`, output Next.js default

### Docker (app + Postgres)

Use the included [`docker-compose.yml`](docker-compose.yml) for Postgres locally. For a full app container, run:

```bash
npm run build
npm run start
```

behind any Node host with `DATABASE_URL` and `JWT_SECRET` set. Point a reverse proxy (Caddy/Nginx) at port 3000 with HTTPS.

### Production checklist

- [ ] Rotate `JWT_SECRET` (not the example value)
- [ ] Use managed Postgres with backups
- [ ] Run `prisma migrate deploy` before first traffic
- [ ] Change default admin/volunteer/member passwords
- [ ] Confirm tablet can install the PWA over HTTPS

## Project status

All 7 modules complete: schema/seed, auth/RBAC, core APIs, volunteer kiosk, public + member portals, admin suite, i18n + offline PWA + deploy docs.
