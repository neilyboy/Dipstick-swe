import { addMonths, isBefore, subDays, subMonths } from 'date-fns';

export type DueStatus = 'up_to_date' | 'due_soon' | 'overdue' | 'unknown';

export interface VehicleLike {
  currentMileage: number | null;
  intervalMiles: number | null;
  intervalMonths: number | null;
  reminderLeadMiles: number | null;
  reminderLeadDays: number | null;
}

export interface ServiceLike {
  mileage: number;
  serviceDate: Date;
  nextDueMileage: number | null;
  nextDueDate: Date | null;
}

export function calculateNextDue(
  service: { mileage: number; serviceDate: Date },
  vehicle: VehicleLike
) {
  const nextMiles =
    vehicle.intervalMiles != null
      ? service.mileage + vehicle.intervalMiles
      : null;
  const nextDate =
    vehicle.intervalMonths != null
      ? addMonths(service.serviceDate, vehicle.intervalMonths)
      : null;
  return { nextMiles, nextDate };
}

export function getDueStatus(
  vehicle: VehicleLike,
  lastService: ServiceLike | null,
  now = new Date()
): {
  status: DueStatus;
  nextMileage: number | null;
  nextDate: Date | null;
  milesRemaining: number | null;
  daysRemaining: number | null;
} {
  if (!lastService || vehicle.currentMileage == null) {
    return {
      status: 'unknown',
      nextMileage: null,
      nextDate: null,
      milesRemaining: null,
      daysRemaining: null
    };
  }

  const nextMileage =
    lastService.nextDueMileage ??
    (vehicle.intervalMiles != null
      ? lastService.mileage + vehicle.intervalMiles
      : null);

  const nextDate =
    lastService.nextDueDate ??
    (vehicle.intervalMonths != null
      ? addMonths(lastService.serviceDate, vehicle.intervalMonths)
      : null);

  const leadMiles = vehicle.reminderLeadMiles ?? 0;
  const leadDays = vehicle.reminderLeadDays ?? 0;

  const milesRemaining =
    nextMileage != null ? nextMileage - vehicle.currentMileage : null;
  const daysRemaining = nextDate
    ? Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let status: DueStatus = 'up_to_date';

  if (nextMileage != null && vehicle.currentMileage >= nextMileage) {
    status = 'overdue';
  } else if (nextDate && isBefore(nextDate, now)) {
    status = 'overdue';
  } else if (
    (milesRemaining != null && milesRemaining <= leadMiles) ||
    (daysRemaining != null && daysRemaining <= leadDays)
  ) {
    status = 'due_soon';
  }

  return { status, nextMileage, nextDate, milesRemaining, daysRemaining };
}
