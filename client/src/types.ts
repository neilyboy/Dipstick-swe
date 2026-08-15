export interface Vehicle {
  id: string;
  displayName: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  currentMileage?: number;
  licensePlate?: string;
  color?: string;
  notes?: string;
  oilType?: string;
  oilViscosity?: string;
  oilBrandPref?: string;
  oilCapacity?: number;
  filterPartNumber?: string;
  filterBrandPref?: string;
  intervalMiles?: number;
  intervalMonths?: number;
  reminderLeadMiles?: number;
  reminderLeadDays?: number;
  coverPhoto?: string;
  photos: string[];
  tags: string[];
  status: 'up_to_date' | 'due_soon' | 'overdue' | 'unknown';
  nextMileage?: number | null;
  nextDate?: string | null;
  milesRemaining?: number | null;
  daysRemaining?: number | null;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  serviceDate: string;
  mileage: number;
  oilBrand?: string;
  oilProduct?: string;
  oilViscosity?: string;
  oilQuantity?: number;
  filterBrand?: string;
  filterModel?: string;
  performedBy?: string;
  cost?: number;
  notes?: string;
  nextDueMileage?: number;
  nextDueDate?: string;
  receipts: string[];
  photos: string[];
  vehicle?: Vehicle;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  partNumber?: string;
  barcode?: string;
  quantity: number;
  unitType: string;
  lowStockThreshold: number;
  costPerUnit?: number;
  storageLocation?: string;
  notes?: string;
  photoUrl?: string;
  lowStock: boolean;
}

export interface Settings {
  id: string;
  defaultIntervalMiles?: number;
  defaultIntervalMonths?: number;
  defaultReminderLeadMiles?: number;
  defaultReminderLeadDays?: number;
}
