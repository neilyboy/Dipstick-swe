# Dipstick v2 — Modern Oil & Service Tracker

A fresh, from-scratch build of Dipstick: a mobile-first, dark-themed PWA for tracking vehicle oil changes, service history, parts inventory, receipts, and backups.

## Highlights

- **Slick dark UI** — glassmorphism, gradient accents, and smooth Framer Motion transitions
- **Mobile-first PWA** — installable on Android and iOS with offline shell caching
- **Vehicle management** — full CRUD, cover photos, VIN, specs, oil preferences
- **Service logging** — date, mileage, oil/filter, cost, notes; auto next-due calculation
- **Inventory** — track oil, filters, washers, supplies, with low-stock alerts
- **Receipt OCR** — upload receipts, run Tesseract OCR, extract merchant/total
- **PDF export** — generate printable service-history PDFs
- **Backup** — one-click JSON export of all data
- **SQLite + Prisma** — single-file database, no separate Postgres container
- **Docker** — one-command self-hosted deployment

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | Express, TypeScript, Prisma, SQLite |
| OCR | Tesseract.js |
| PDF | PDFKit |
| PWA | vite-plugin-pwa, Workbox |
| Tests | Vitest |

## Quick start

```bash
cp .env.example .env

# Server
cd server
npm install
npx prisma db push
npx prisma db seed
npm run dev

# Client (new terminal)
cd ../client
npm install
npm run dev
```

Open `http://localhost:5173`. The API proxy is at `http://localhost:3001`.

## Docker

```bash
docker compose up -d --build
```

The app runs on `http://localhost:3001`. Data and uploads are persisted in named volumes.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | `file:./data/dipstick.db` | SQLite file path |
| `UPLOAD_DIR` | `./uploads` | Photo/receipt upload path |
| `NODE_ENV` | `development` | Environment |

## Branch

This is the `from-scratch` branch, containing a complete reimplementation from a clean slate.
