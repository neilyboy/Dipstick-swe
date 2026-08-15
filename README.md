# Dipstick — Oil Change Tracker & Service History

A production-ready, mobile-first PWA for tracking vehicle oil changes, parts inventory, receipts, and service history. Installable on Android and iPhone, works in desktop browsers, and runs self-hosted in Docker.

## Features

- **Vehicle Management** — Track multiple vehicles with detailed specs, photos, oil requirements, and tool notes
- **Service Logging** — Log oil changes with oil/filter details, mileage, cost, and service checks
- **Due/Overdue Tracking** — Automatic due-soon and overdue status based on mileage and date intervals
- **Inventory Management** — Track oil, filters, washers, tools, and supplies with low-stock alerts
- **Receipt OCR** — Upload receipts and extract merchant, date, total, and line items with Tesseract.js
- **PDF Export** — Generate professional, printable service history PDFs for any vehicle
- **CSV Export** — Export service records as CSV
- **Reminders** — In-app alerts for due/overdue services and low inventory
- **Backup & Restore** — Full data export/import with optional S3-compatible cloud backup
- **PWA** — Installable on mobile with offline shell caching and service worker
- **Dark Theme** — Mobile-first dark UI with Tailwind CSS
- **Docker** — One-command Docker Compose deployment for Ubuntu

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Express, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| PDF | Puppeteer (headless Chromium) |
| OCR | Tesseract.js (in-process, no external service) |
| PWA | vite-plugin-pwa, Workbox |
| Testing | Vitest |
| Deployment | Docker, Docker Compose |

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/neilyboy/Dipstick-swe.git
cd Dipstick-swe

# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Set up database
cd server
npx prisma db push
npx prisma db seed
cd ..

# Start development
npm run dev
```

The app will be available at `http://localhost:5173` (client) and `http://localhost:3001` (API).

### Database Commands

```bash
cd server
npx prisma db push          # Apply schema to database
npx prisma db seed           # Load demo data
npx prisma studio            # Open Prisma Studio GUI
npx prisma migrate dev       # Create migration (for schema changes)
```

## Docker Deployment (Production)

### Using Docker Compose

```bash
# Clone and configure
cp .env.example .env
# Edit .env with production values (SESSION_SECRET required)

# Start everything
docker compose up -d

# Run database migrations
docker compose exec app node server/node_modules/.bin/prisma migrate deploy

# Seed demo data (optional)
docker compose exec app node server/node_modules/.bin/prisma db seed
```

The app will be available at `http://localhost:3001`.

### Volumes

| Volume | Purpose |
|--------|---------|
| `dipstick-uploads` | Uploaded photos, receipts, and generated backups |
| `dipstick-data` | Application data directory |
| `dipstick-postgres` | PostgreSQL database files |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://dipstick:dipstick@localhost:5432/dipstick` | PostgreSQL connection string |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `UPLOAD_DIR` | `./uploads` | File upload storage path |
| `MAX_FILE_SIZE_MB` | `20` | Maximum upload file size |
| `SESSION_SECRET` | — | Secret for session tokens (required in production) |
| `S3_ENDPOINT` | — | S3-compatible storage endpoint (optional) |
| `S3_ACCESS_KEY` | — | S3 access key |
| `S3_SECRET_KEY` | — | S3 secret key |
| `S3_BUCKET` | `dipstick-backups` | S3 bucket name |
| `S3_REGION` | `us-east-1` | S3 region |
| `VAPID_PUBLIC_KEY` | — | Web Push VAPID public key (optional) |
| `VAPID_PRIVATE_KEY` | — | Web Push VAPID private key |
| `VIN_DECODE_API_KEY` | — | VIN decoder API key (optional) |

## Project Structure

```
dipstick-oil-tracker/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # API client, types, utilities
│   │   └── styles/          # CSS
│   └── public/              # Static assets, PWA icons
├── server/                  # Express backend
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic (OCR, PDF, backup)
│   │   ├── middleware/       # Express middleware
│   │   └── utils/           # Validation, calculations, storage
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── seed.ts          # Demo data seeder
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Production Docker image
└── .env.example             # Environment variables template
```

## API Endpoints

### Vehicles
- `GET /api/vehicles` — List vehicles (search, filter, sort)
- `GET /api/vehicles/:id` — Get vehicle with due status
- `POST /api/vehicles` — Create vehicle
- `PUT /api/vehicles/:id` — Update vehicle
- `DELETE /api/vehicles/:id` — Delete vehicle
- `POST /api/vehicles/:id/photos` — Upload vehicle photo
- `GET /api/vehicles/:id/due-status` — Get due status

### Services
- `GET /api/services` — List service records
- `POST /api/services` — Create service record
- `PUT /api/services/:id` — Update service record
- `DELETE /api/services/:id` — Delete service record
- `POST /api/services/:id/photos` — Upload service photo

### Inventory
- `GET /api/inventory` — List inventory items
- `POST /api/inventory` — Create inventory item
- `PUT /api/inventory/:id` — Update item
- `DELETE /api/inventory/:id` — Archive item
- `POST /api/inventory/:id/adjust` — Adjust quantity
- `GET /api/inventory/stats/summary` — Get stats

### Receipts
- `POST /api/receipts/upload` — Upload receipt (triggers OCR)
- `GET /api/receipts/:id` — Get receipt with OCR results
- `POST /api/receipts/:id/ocr` — Re-run OCR
- `PUT /api/receipts/:id` — Update/confirm OCR results

### Exports
- `GET /api/exports/vehicle/:id/pdf` — Download service history PDF
- `GET /api/exports/vehicle/:id/csv` — Download CSV

### Backups
- `GET /api/backups/export` — Download full data export (JSON)
- `POST /api/backups/create` — Create server backup

## Business Rules

### Due Status Calculation
Each vehicle's service status is calculated from:
1. **Overdue**: Current mileage >= next due mileage, OR current date >= next due date
2. **Due Soon**: Within reminder threshold (default 500 miles or 30 days) of next due
3. **Up to Date**: Neither overdue nor due soon
4. **Unknown**: Insufficient data (no intervals or service history)

When both mileage and date intervals exist, the sooner condition takes precedence.

### Next Due Calculation
When a service is logged, next due values are auto-calculated:
- `nextDueMileage` = service mileage + vehicle's interval miles
- `nextDueDate` = service date + vehicle's interval months
- Manual overrides are supported

## OCR Pipeline

Receipt OCR uses Tesseract.js running in-process:
1. Upload receipt image (photo or file)
2. OCR runs automatically in background
3. Extracts: merchant name, date, total, tax, line items
4. Results are reviewable and editable before confirmation
5. OCR failures do not block service logging

## Backup & Restore

### Export (Manual)
- Settings → "Export All Data" downloads a JSON file
- Settings → "Create Server Backup" saves to server

### Cloud Backup (Optional)
Configure S3-compatible backup target in Settings or via environment variables. Backups include all data and metadata.

### Restore
Import a previously exported JSON backup through the API or manually via the database.

## Security

This is a single-user, self-hosted application by design:
- Deploy behind a reverse proxy (Nginx, Traefik, Caddy) for TLS
- Set `SESSION_SECRET` in production
- No built-in authentication — assume trusted/private network deployment
- File uploads are validated and sanitized
- Input validation via Zod on all endpoints

## Future Roadmap

- [ ] Additional maintenance types (tire rotations, brakes, inspections)
- [ ] Cost analytics and trends
- [ ] Multi-user support with roles
- [ ] Full offline sync with conflict resolution
- [ ] AI-powered maintenance recommendations
- [ ] Mobile push notifications via web push
- [ ] Barcode/UPC product lookup integration
- [ ] VIN decode integration for auto-populating vehicle data

## License

MIT
