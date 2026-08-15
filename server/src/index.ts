import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
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
  const headerH = 130;
  const grad = doc.linearGradient(0, 0, W, headerH).stop(0, '#0B0F19').stop(1, '#1e293b');
  doc.rect(0, 0, W, headerH).fill(grad);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#94a3b8').text('Dipstick Service History', 50, 15);

  const title = `${vehicle.displayName}`;
  const subtitle = `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || 'Vehicle profile';

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(title, 50, 35);
  doc.font('Helvetica').fontSize(11).fillColor('#cbd5e1').text(subtitle, 50, 65);
  doc.strokeColor('#38bdf8').lineWidth(2).moveTo(50, 82).lineTo(200, 82).stroke();

  const metaY = 90;
  if (vehicle.vin) {
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text(`VIN: ${vehicle.vin}`, 50, metaY);
  }
  if (vehicle.currentMileage != null) {
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text(`Mileage: ${vehicle.currentMileage.toLocaleString()} mi`, 50, metaY + 14);
  }

  if (vehicle.coverPhoto) {
    const photoPath = path.join(uploadDir, vehicle.coverPhoto);
    if (fs.existsSync(photoPath)) {
      try {
        const maxW = 90;
        const maxH = 90;
        const imgX = W - 50 - maxW;
        const imgY = 20;
        const r = 6;

        // Read image dimensions from file header
        const buf = fs.readFileSync(photoPath);
        let natW = 0, natH = 0;
        if (buf[0] === 0x89 && buf[1] === 0x50) {
          // PNG: width at bytes 16-19, height at 20-23 (big-endian)
          natW = buf.readUInt32BE(16);
          natH = buf.readUInt32BE(20);
        } else if (buf[0] === 0xff && buf[1] === 0xd8) {
          // JPEG: scan for SOF0/SOF2 marker
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
          // Calculate fitted dimensions preserving aspect ratio
          const scale = Math.min(maxW / natW, maxH / natH);
          const fitW = natW * scale;
          const fitH = natH * scale;

          // Clip to rounded rect, draw image, then stroke border
          doc.save();
          doc.roundedRect(imgX, imgY, fitW, fitH, r).clip();
          doc.image(photoPath, imgX, imgY, { width: fitW, height: fitH });
          doc.restore();

          doc.strokeColor('#38bdf8').lineWidth(1.5).opacity(0.5)
            .roundedRect(imgX, imgY, fitW, fitH, r).stroke();
          doc.opacity(1);
        }
      } catch {
        // ignore bad/corrupt image
      }
    }
  }

  // ─── VEHICLE INFO CARD ─────────────────────────────────────────────────────
  let y = 155;
  doc.fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).roundedRect(40, y, W - 80, 100, 8).fillAndStroke();

  const info: { label: string; value: string }[] = [
    { label: 'Year', value: vehicle.year ? String(vehicle.year) : '-' },
    { label: 'Make', value: vehicle.make || '-' },
    { label: 'Model', value: vehicle.model || '-' },
    { label: 'Engine', value: vehicle.engine || (vinDetails?.EngineCylinders ? `${vinDetails.EngineCylinders}cyl ${vinDetails.DisplacementL ? `${vinDetails.DisplacementL}L` : ''}`.trim() : '-') },
    { label: 'License plate', value: vehicle.licensePlate || '-' },
    { label: 'VIN', value: vehicle.vin || '-' },
    { label: 'Mileage', value: vehicle.currentMileage != null ? `${vehicle.currentMileage.toLocaleString()} mi` : '-' },
    { label: 'Oil', value: [vehicle.oilBrandPref, vehicle.oilViscosity].filter(Boolean).join(' ') || '-' }
  ];

  let cx = 60;
  let rowY = y + 15;
  info.forEach((item, i) => {
    const col = i % 4;
    const x = 60 + col * 125;
    if (i > 0 && col === 0) rowY += 55;
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text(item.label.toUpperCase(), x, rowY);
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(item.value, x, rowY + 12, { width: 110, lineBreak: true });
  });

  // ─── VIN-DERIVED DETAILS ───────────────────────────────────────────────────
  y = 285;
  if (vinDetails) {
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text('Vehicle details from VIN', 40, y);
    doc.strokeColor('#38bdf8').lineWidth(2).moveTo(40, y + 18).lineTo(250, y + 18).stroke();

    const details: { label: string; value?: string }[] = [
      { label: 'Vehicle type', value: vinDetails.VehicleType },
      { label: 'Body class', value: vinDetails.BodyClass },
      { label: 'Drive type', value: vinDetails.DriveType },
      { label: 'Fuel type', value: vinDetails.FuelTypePrimary },
      { label: 'Transmission', value: vinDetails.TransmissionStyle },
      { label: 'Doors', value: vinDetails.Doors },
      { label: 'Seats', value: vinDetails.Seats },
      { label: 'Trim', value: vinDetails.Trim }
    ];

    const detailRows = details.filter((d) => d.value).map((d) => ({ ...d, value: String(d.value) }));
    doc.fillColor('#f8fafc').strokeColor('#e2e8f0').roundedRect(40, y + 30, W - 80, 60, 8).fillAndStroke();

    detailRows.forEach((item, i) => {
      const col = i % 4;
      const x = 60 + col * 125;
      const ry = y + 40 + Math.floor(i / 4) * 26;
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b').text(item.label.toUpperCase(), x, ry);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(item.value, x, ry + 11, { width: 110 });
    });
    y += 110;
  }

  // ─── SERVICE HISTORY TABLE ─────────────────────────────────────────────────
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
  res.setHeader('Content-Disposition', 'attachment; filename="dipstick-backup.json"');
  res.json({ vehicles, services, inventory, receipts, settings, exportedAt: new Date() });
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
