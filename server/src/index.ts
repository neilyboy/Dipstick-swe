import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createWorker } from 'tesseract.js';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { calculateNextDue, getDueStatus } from './lib/due.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT ?? 3001);
const uploadDir = process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../../uploads');

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

const prisma = new PrismaClient();

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuid()}-${file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function jsonParse<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ─── VEHICLES ───────────────────────────────────────────────────────────────

const vehicleSchema = z.object({
  displayName: z.string().min(1),
  vin: z.string().optional(),
  year: z.coerce.number().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  engine: z.string().optional(),
  currentMileage: z.coerce.number().optional(),
  licensePlate: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
  oilType: z.string().optional(),
  oilViscosity: z.string().optional(),
  oilBrandPref: z.string().optional(),
  oilCapacity: z.coerce.number().optional(),
  filterPartNumber: z.string().optional(),
  filterBrandPref: z.string().optional(),
  intervalMiles: z.coerce.number().optional(),
  intervalMonths: z.coerce.number().optional(),
  reminderLeadMiles: z.coerce.number().optional(),
  reminderLeadDays: z.coerce.number().optional()
});

async function withVehicleStatus(vehicle: any) {
  const services = await prisma.serviceRecord.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { serviceDate: 'desc' },
    take: 1
  });
  const lastService = services[0] || null;
  const due = getDueStatus(vehicle, lastService);
  return {
    ...vehicle,
    coverPhoto: vehicle.coverPhoto ? `/uploads/${vehicle.coverPhoto}` : null,
    photos: jsonParse<string[]>(vehicle.photos) ?? [],
    tags: jsonParse<string[]>(vehicle.tags) ?? [],
    status: due.status,
    nextMileage: due.nextMileage,
    nextDate: due.nextDate,
    milesRemaining: due.milesRemaining,
    daysRemaining: due.daysRemaining
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/stats', async (_req, res) => {
  const [vehicleCount, serviceCount, inventoryCount, lowStock] = await Promise.all([
    prisma.vehicle.count({ where: { archived: false } }),
    prisma.serviceRecord.count(),
    prisma.inventoryItem.count({ where: { archived: false } }),
    prisma.inventoryItem.count({
      where: {
        archived: false,
        quantity: { lte: prisma.inventoryItem.fields.lowStockThreshold }
      }
    })
  ]);
  res.json({ vehicleCount, serviceCount, inventoryCount, lowStock });
});

app.get('/api/vehicles', async (req, res) => {
  const search = String(req.query.search ?? '');
  const status = String(req.query.status ?? '');
  const sort = String(req.query.sort ?? 'updatedAt');
  const vehicles = await prisma.vehicle.findMany({
    where: { archived: false },
    orderBy: sort === 'mileage' ? { currentMileage: 'desc' } : { updatedAt: 'desc' }
  });
  let items = await Promise.all(vehicles.map(withVehicleStatus));
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (v) =>
        v.displayName.toLowerCase().includes(q) ||
        (v.make && v.make.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q)) ||
        (v.vin && v.vin.toLowerCase().includes(q))
    );
  }
  if (status && status !== 'all') {
    items = items.filter((v) => v.status === status);
  }
  res.json(items);
});

app.post('/api/vehicles', upload.single('coverPhoto'), async (req, res) => {
  const data = vehicleSchema.parse(req.body);
  const settings = await prisma.setting.findFirst();
  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      coverPhoto: req.file?.filename,
      intervalMiles: data.intervalMiles ?? settings?.defaultIntervalMiles ?? 5000,
      intervalMonths: data.intervalMonths ?? settings?.defaultIntervalMonths ?? 6,
      reminderLeadMiles: data.reminderLeadMiles ?? settings?.defaultReminderLeadMiles ?? 500,
      reminderLeadDays: data.reminderLeadDays ?? settings?.defaultReminderLeadDays ?? 30
    }
  });
  res.status(201).json(await withVehicleStatus(vehicle));
});

app.get('/api/vehicles/:id', async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(await withVehicleStatus(vehicle));
});

app.put('/api/vehicles/:id', async (req, res) => {
  const data = vehicleSchema.parse(req.body);
  const vehicle = await prisma.vehicle.update({ where: { id: req.params.id }, data });
  res.json(await withVehicleStatus(vehicle));
});

app.delete('/api/vehicles/:id', async (req, res) => {
  await prisma.vehicle.update({ where: { id: req.params.id }, data: { archived: true } });
  res.json({ ok: true });
});

app.post('/api/vehicles/:id/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo' });
  const vehicle = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: { coverPhoto: req.file.filename }
  });
  res.json(await withVehicleStatus(vehicle));
});

// ─── SERVICES ───────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  vehicleId: z.string(),
  serviceDate: z.coerce.date(),
  mileage: z.coerce.number(),
  oilBrand: z.string().optional(),
  oilProduct: z.string().optional(),
  oilViscosity: z.string().optional(),
  oilQuantity: z.coerce.number().optional(),
  filterBrand: z.string().optional(),
  filterModel: z.string().optional(),
  performedBy: z.string().optional(),
  cost: z.coerce.number().optional(),
  notes: z.string().optional(),
  nextDueMileage: z.coerce.number().optional(),
  nextDueDate: z.coerce.date().optional()
});

app.get('/api/services', async (req, res) => {
  const { vehicleId } = req.query;
  const items = await prisma.serviceRecord.findMany({
    where: vehicleId ? { vehicleId: String(vehicleId) } : undefined,
    orderBy: { serviceDate: 'desc' },
    include: { vehicle: true }
  });
  res.json(
    items.map((s) => ({
      ...s,
      receipts: jsonParse<string[]>(s.receipts) ?? [],
      photos: jsonParse<string[]>(s.photos) ?? []
    }))
  );
});

app.post(
  '/api/services',
  upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'receipts', maxCount: 5 }
  ]),
  async (req, res) => {
    const data = serviceSchema.parse(req.body);
    const files = (req as any).files as { photos?: Express.Multer.File[]; receipts?: Express.Multer.File[] } | undefined;
    const photoNames = files?.photos?.map((f) => f.filename) ?? [];
    const receiptNames = files?.receipts?.map((f) => f.filename) ?? [];

    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const nextDue = calculateNextDue(
      { mileage: data.mileage, serviceDate: data.serviceDate },
      vehicle
    );

    const service = await prisma.$transaction(async (tx) => {
      if (vehicle.currentMileage == null || data.mileage > vehicle.currentMileage) {
        await tx.vehicle.update({
          where: { id: data.vehicleId },
          data: { currentMileage: data.mileage }
        });
      }
      return tx.serviceRecord.create({
        data: {
          ...data,
          nextDueMileage: data.nextDueMileage ?? nextDue.nextMiles,
          nextDueDate: data.nextDueDate ?? nextDue.nextDate,
          photos: JSON.stringify(photoNames),
          receipts: JSON.stringify(receiptNames)
        }
      });
    });

    res.status(201).json({
      ...service,
      receipts: receiptNames,
      photos: photoNames
    });
  }
);

app.put('/api/services/:id', async (req, res) => {
  const data = serviceSchema.partial().parse(req.body);
  const service = await prisma.serviceRecord.update({ where: { id: req.params.id }, data });
  res.json(service);
});

app.delete('/api/services/:id', async (req, res) => {
  await prisma.serviceRecord.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ─── INVENTORY ──────────────────────────────────────────────────────────────

const inventorySchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  partNumber: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.coerce.number().default(0),
  unitType: z.string().default('each'),
  lowStockThreshold: z.coerce.number().default(1),
  costPerUnit: z.coerce.number().optional(),
  storageLocation: z.string().optional(),
  notes: z.string().optional()
});

app.get('/api/inventory', async (req, res) => {
  const { category } = req.query;
  const items = await prisma.inventoryItem.findMany({
    where: {
      archived: false,
      ...(category ? { category: String(category) } : {})
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(
    items.map((i) => ({
      ...i,
      lowStock: i.quantity <= i.lowStockThreshold,
      photoUrl: i.photoFilename ? `/uploads/${i.photoFilename}` : null
    }))
  );
});

app.post('/api/inventory', async (req, res) => {
  const data = inventorySchema.parse(req.body);
  const item = await prisma.inventoryItem.create({ data });
  res.status(201).json(item);
});

app.put('/api/inventory/:id', async (req, res) => {
  const data = inventorySchema.partial().parse(req.body);
  const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data });
  res.json(item);
});

app.delete('/api/inventory/:id', async (req, res) => {
  await prisma.inventoryItem.update({ where: { id: req.params.id }, data: { archived: true } });
  res.json({ ok: true });
});

app.post('/api/inventory/:id/adjust', async (req, res) => {
  const { quantity } = z.object({ quantity: z.coerce.number() }).parse(req.body);
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { quantity: { increment: quantity } }
  });
  res.json(item);
});

// ─── RECEIPTS / OCR ─────────────────────────────────────────────────────────

app.post('/api/receipts', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No receipt uploaded' });
  try {
    const worker = await createWorker('eng');
    const {
      data: { text }
    } = await worker.recognize(path.join(uploadDir, req.file.filename));
    await worker.terminate();

    const totalMatch = text.match(/(?:total|amount|balance)[^0-9]*(\d+[.,]?\d{0,2})/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : null;
    const merchantMatch = text.match(/^(.*?)\n/);
    const merchant = merchantMatch ? merchantMatch[1].trim().slice(0, 60) : null;

    const receipt = await prisma.receipt.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        ocrText: text,
        merchantName: merchant,
        total
      }
    });

    res.json({ ...receipt, url: `/uploads/${receipt.filename}` });
  } catch (err) {
    const receipt = await prisma.receipt.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname
      }
    });
    res.json({ ...receipt, url: `/uploads/${receipt.filename}`, ocrError: String(err) });
  }
});

app.get('/api/receipts/:id', async (req, res) => {
  const receipt = await prisma.receipt.findUnique({ where: { id: req.params.id } });
  if (!receipt) return res.status(404).json({ error: 'Not found' });
  res.json({ ...receipt, url: `/uploads/${receipt.filename}` });
});

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

app.get('/api/exports/vehicle/:id/pdf', async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: req.params.id },
    include: { services: { orderBy: { serviceDate: 'desc' } } }
  });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  let vinDetails: any = null;
  if (vehicle.vin) {
    try {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vehicle.vin)}?format=json`;
      const r = await fetch(url);
      vinDetails = ((await r.json()) as any)?.Results?.[0] ?? null;
    } catch {
      vinDetails = null;
    }
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${vehicle.displayName.replace(/[^a-zA-Z0-9\-_]/g, '_')}-service-history.pdf"`);

  const doc = new PDFDocument({ margins: { top: 0, left: 0, right: 0, bottom: 0 } });
  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;

  // ─── HEADER ────────────────────────────────────────────────────────────────
  const headerH = 110;
  const imgAreaW = 200;       // right-side image area width
  const textAreaW = W - imgAreaW; // left-side text panel width

  // Left panel: solid dark background (always readable)
  const grad = doc.linearGradient(0, 0, textAreaW, 0).stop(0, '#0B0F19').stop(1, '#1e293b');
  doc.rect(0, 0, textAreaW, headerH).fill(grad);

  // Right panel: cover image (cover-crop to fill the area), or dark fallback
  if (vehicle.coverPhoto) {
    const photoPath = path.join(uploadDir, vehicle.coverPhoto);
    if (fs.existsSync(photoPath)) {
      try {
        const buf = fs.readFileSync(photoPath);
        let natW = 0, natH = 0;
        if (buf[0] === 0x89 && buf[1] === 0x50) {
          natW = buf.readUInt32BE(16);
          natH = buf.readUInt32BE(20);
        } else if (buf[0] === 0xff && buf[1] === 0xd8) {
          let off = 2;
          while (off < buf.length - 1) {
            if (buf[off] !== 0xff) { off++; continue; }
            const marker = buf[off + 1];
            if (marker === 0xc0 || marker === 0xc2) {
              natH = buf.readUInt16BE(off + 5);
              natW = buf.readUInt16BE(off + 7);
              break;
            }
            off += 2 + buf.readUInt16BE(off + 2);
          }
        }

        if (natW > 0 && natH > 0) {
          // Cover-crop: scale to fill area, center crop
          const scale = Math.max(imgAreaW / natW, headerH / natH);
          const drawW = natW * scale;
          const drawH = natH * scale;
          const imgX = textAreaW + (imgAreaW - drawW) / 2;
          const imgY = (headerH - drawH) / 2;

          doc.save();
          doc.rect(textAreaW, 0, imgAreaW, headerH).clip();
          doc.image(photoPath, imgX, imgY, { width: drawW, height: drawH });
          doc.restore();

          // Subtle gradient on left edge of image for smooth transition
          const blendGrad = doc.linearGradient(textAreaW, 0, textAreaW + 40, 0)
            .stop(0, 'rgba(11,15,25,0.6)').stop(1, 'rgba(11,15,25,0)');
          doc.rect(textAreaW, 0, 40, headerH).fill(blendGrad);
        }
      } catch {
        // ignore bad/corrupt image — fallback below
      }
    }
  }

  // Fallback: if no image or image failed, fill right area with dark gradient too
  if (!vehicle.coverPhoto) {
    const grad2 = doc.linearGradient(textAreaW, 0, W, 0).stop(0, '#1e293b').stop(1, '#0B0F19');
    doc.rect(textAreaW, 0, imgAreaW, headerH).fill(grad2);
  }

  // ─── HEADER TEXT (on left panel) ───────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#94a3b8').text('DIPSTICK SERVICE HISTORY', 40, 14);

  const title = `${vehicle.displayName}`;
  const subtitle = `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || 'Vehicle profile';

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(title, 40, 30, { width: textAreaW - 60 });
  doc.font('Helvetica').fontSize(10).fillColor('#cbd5e1').text(subtitle, 40, 58, { width: textAreaW - 60 });
  doc.strokeColor('#38bdf8').lineWidth(1.5).moveTo(40, 74).lineTo(160, 74).stroke();

  // ─── COMPACT INFO LINE ─────────────────────────────────────────────────────
  const infoParts: string[] = [];
  if (vehicle.year) infoParts.push(String(vehicle.year));
  if (vehicle.make) infoParts.push(vehicle.make);
  if (vehicle.model) infoParts.push(vehicle.model);
  if (vehicle.engine) infoParts.push(vehicle.engine);
  else if (vinDetails?.EngineCylinders) infoParts.push(`${vinDetails.EngineCylinders}cyl${vinDetails.DisplacementL ? ` ${vinDetails.DisplacementL}L` : ''}`);
  if (vehicle.licensePlate) infoParts.push(`PLT: ${vehicle.licensePlate}`);
  if (vehicle.vin) infoParts.push(`VIN: ${vehicle.vin}`);
  if (vehicle.currentMileage != null) infoParts.push(`${vehicle.currentMileage.toLocaleString()} mi`);
  if (vehicle.oilBrandPref || vehicle.oilViscosity) infoParts.push(`Oil: ${[vehicle.oilBrandPref, vehicle.oilViscosity].filter(Boolean).join(' ')}`);

  let y = 128;
  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(infoParts.join('  ·  '), 50, y, { width: W - 100 });

  // ─── SERVICE HISTORY TABLE ─────────────────────────────────────────────────
  y = 148;
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text('Service History', 40, y);
  doc.strokeColor('#38bdf8').lineWidth(2).moveTo(40, y + 18).lineTo(180, y + 18).stroke();

  const tableTop = y + 30;
  const rowH = 28;
  const cols = [50, 115, 200, 355, 415];
  const colWidths = [55, 75, 145, 50, 170];

  doc.fillColor('#0f172a').rect(40, tableTop, W - 80, rowH).fill();
  const headers = ['Date', 'Mileage', 'Oil / Filter', 'Cost', 'Notes'];
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  headers.forEach((h, i) => doc.text(h, cols[i], tableTop + 8, { width: colWidths[i], align: 'left' }));

  if (vehicle.services.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No service records yet.', 50, tableTop + 40);
  } else {
    vehicle.services.forEach((s, i) => {
      const ry = tableTop + rowH + i * rowH;
      if (ry + rowH > H - 60) {
        doc.addPage();
      }
      const fill = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
      doc.fillColor(fill).rect(40, ry, W - 80, rowH).fill();

      doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
        .text(new Date(s.serviceDate).toLocaleDateString(), cols[0], ry + 6, { width: colWidths[0] })
        .text(`${s.mileage.toLocaleString()} mi`, cols[1], ry + 6, { width: colWidths[1] })
        .text(`${s.oilBrand ?? ''} ${s.oilViscosity ?? ''}`.trim() || '—', cols[2], ry + 6, { width: colWidths[2], height: 12, ellipsis: true })
        .text(s.cost != null ? `$${s.cost.toFixed(2)}` : '—', cols[3], ry + 6, { width: colWidths[3] })
        .text(s.notes ?? '', cols[4], ry + 6, { width: colWidths[4], height: 12, ellipsis: true });
    });
  }

  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text('Generated by Dipstick', 40, H - 30, { align: 'center', width: W - 80 });
  doc.end();
});

// ─── BACKUPS ─────────────────────────────────────────────────────────────────

app.get('/api/backups/export', async (_req, res) => {
  const [vehicles, services, inventory, receipts, settings] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.serviceRecord.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.receipt.findMany(),
    prisma.setting.findMany()
  ]);

  const data = { vehicles, services, inventory, receipts, settings, exportedAt: new Date() };

  // Create zip in memory using archiver
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Add JSON data
  archive.append(JSON.stringify(data, null, 2), { name: 'backup.json' });

  // Add uploads directory
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      if (fs.statSync(filePath).isFile()) {
        archive.file(filePath, { name: `uploads/${file}` });
      }
    }
  }

  await archive.finalize();
  const zipBuf = Buffer.concat(chunks);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="dipstick-backup.zip"');
  res.send(zipBuf);
});

app.post('/api/backups/import', upload.single('backup'), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const tmpDir = path.join(os.tmpdir(), 'dipstick-restore-' + uuid());
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Extract zip using adm-zip (pure JS, no system binaries)
    const zip = new AdmZip(file.path);
    zip.extractAllTo(tmpDir, true);

    const jsonPath = path.join(tmpDir, 'backup.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(400).json({ error: 'Invalid backup file: no backup.json found' });
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Restore uploads
    const uploadsSrc = path.join(tmpDir, 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      const uploadFiles = fs.readdirSync(uploadsSrc);
      for (const f of uploadFiles) {
        fs.copyFileSync(path.join(uploadsSrc, f), path.join(uploadDir, f));
      }
    }

    // Wipe and restore database
    await prisma.$transaction([
      prisma.serviceRecord.deleteMany(),
      prisma.vehicle.deleteMany(),
      prisma.inventoryItem.deleteMany(),
      prisma.receipt.deleteMany(),
      prisma.setting.deleteMany()
    ]);

    if (data.settings) {
      for (const s of data.settings) {
        await prisma.setting.upsert({ where: { id: s.id }, create: s, update: s });
      }
    }
    if (data.vehicles) {
      for (const v of data.vehicles) {
        await prisma.vehicle.create({ data: v });
      }
    }
    if (data.services) {
      for (const s of data.services) {
        await prisma.serviceRecord.create({ data: s });
      }
    }
    if (data.inventory) {
      for (const i of data.inventory) {
        await prisma.inventoryItem.create({ data: i });
      }
    }
    if (data.receipts) {
      for (const r of data.receipts) {
        await prisma.receipt.create({ data: r });
      }
    }

    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', message: String(err) });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(file.path, { force: true });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  defaultIntervalMiles: z.coerce.number().optional(),
  defaultIntervalMonths: z.coerce.number().optional(),
  defaultReminderLeadMiles: z.coerce.number().optional(),
  defaultReminderLeadDays: z.coerce.number().optional()
});

app.get('/api/settings', async (_req, res) => {
  const settings = await prisma.setting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' }
  });
  res.json(settings);
});

app.put('/api/settings', async (req, res) => {
  const data = settingsSchema.parse(req.body);
  const settings = await prisma.setting.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data
  });
  res.json(settings);
});

// ─── VIN DECODE ─────────────────────────────────────────────────────────────

app.get('/api/vin/:vin', async (req, res) => {
  const { vin } = req.params;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return res.status(400).json({ error: 'Invalid VIN' });
  }
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url);
    const json = (await response.json()) as any;
    const result = json?.Results?.[0];
    if (!result) return res.status(404).json({ error: 'VIN not found' });

    const year = result.ModelYear ? Number(result.ModelYear) : undefined;
    const make = result.Make || undefined;
    const model = result.Model || undefined;
    const engine =
      [result.DisplacementL && `${result.DisplacementL}L`, result.EngineCylinders && `${result.EngineCylinders}cyl`]
        .filter(Boolean)
        .join(' ') || undefined;

    res.json({ year, make, model, engine, raw: result });
  } catch (err) {
    res.status(502).json({ error: 'VIN lookup failed', message: String(err) });
  }
});

// ─── CLIENT SPA ──────────────────────────────────────────────────────────────

const clientDist = path.resolve(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Dipstick v2 running on port ${port}`);
});
