import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  await prisma.vehicle.deleteMany();
  await prisma.serviceRecord.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.setting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' }
  });

  const car = await prisma.vehicle.create({
    data: {
      displayName: 'Daily Driver',
      year: 2020,
      make: 'Honda',
      model: 'Civic',
      engine: '2.0L',
      currentMileage: 42_500,
      oilType: 'Synthetic',
      oilViscosity: '0W-20',
      filterBrandPref: 'Honda',
      intervalMiles: 6000,
      intervalMonths: 8,
      reminderLeadMiles: 500,
      reminderLeadDays: 30
    }
  });

  await prisma.serviceRecord.create({
    data: {
      vehicleId: car.id,
      serviceDate: addDays(new Date(), -120),
      mileage: 36_000,
      oilBrand: 'Mobil 1',
      oilProduct: 'Advanced Fuel Economy',
      oilViscosity: '0W-20',
      oilQuantity: 4.4,
      filterBrand: 'Honda',
      filterModel: 'OEM',
      cost: 55,
      notes: 'Standard oil change.',
      nextDueMileage: 42_000,
      nextDueDate: addDays(new Date(), -60)
    }
  });

  await prisma.inventoryItem.createMany({
    data: [
      { name: 'Mobil 1 0W-20', category: 'oil', brand: 'Mobil 1', quantity: 5, unitType: 'quart', lowStockThreshold: 2 },
      { name: 'Honda OEM Filter', category: 'filter', brand: 'Honda', quantity: 2, unitType: 'each', lowStockThreshold: 1 },
      { name: 'Crush washers', category: 'washer', quantity: 20, unitType: 'each', lowStockThreshold: 5 },
      { name: 'Nitrile gloves', category: 'supply', quantity: 12, unitType: 'pair', lowStockThreshold: 3 }
    ]
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
