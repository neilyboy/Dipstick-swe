import { describe, it, expect } from 'vitest';
import { calculateNextDue, getDueStatus } from './due';

const vehicle = {
  currentMileage: 42_500,
  intervalMiles: 5_000,
  intervalMonths: 6,
  reminderLeadMiles: 500,
  reminderLeadDays: 30
};

const lastService = {
  mileage: 38_000,
  serviceDate: new Date('2024-01-01'),
  nextDueMileage: 43_000,
  nextDueDate: new Date('2024-07-01')
};

describe('calculateNextDue', () => {
  it('adds interval to service', () => {
    const res = calculateNextDue({ mileage: 10_000, serviceDate: new Date('2024-01-15') }, vehicle);
    expect(res.nextMiles).toBe(15_000);
    expect(res.nextDate?.getFullYear()).toBe(2024);
    expect(res.nextDate?.getMonth()).toBe(6);
  });
});

describe('getDueStatus', () => {
  it('marks overdue when past next due mileage', () => {
    const v = { ...vehicle, currentMileage: 44_000 };
    const result = getDueStatus(v, lastService, new Date('2024-08-15'));
    expect(result.status).toBe('overdue');
  });

  it('marks due soon when within lead miles', () => {
    const v = { ...vehicle, currentMileage: 42_600 };
    const result = getDueStatus(v, lastService, new Date('2024-06-15'));
    expect(result.status).toBe('due_soon');
  });

  it('marks up to date otherwise', () => {
    const v = { ...vehicle, currentMileage: 40_000 };
    const result = getDueStatus(v, lastService, new Date('2024-03-15'));
    expect(result.status).toBe('up_to_date');
  });
});
