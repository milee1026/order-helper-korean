import { loadRecords } from '@/utils/storage';
import { loadAutomationRecords } from '@/utils/automationStorage';
import { Vendor } from '@/types';

/**
 * Determine if inbound field should be shown on a given order day.
 * Normal rules:
 *   Farmers: only Monday (1) — Sunday order arrives Monday
 *   Marketbom: Tuesday (2) and Thursday (4) — prev order arrives
 *
 * If exceptionNoDelivery is true for today, inbound is hidden.
 */
export function shouldShowInbound(
  vendor: Vendor,
  dayOfWeek: number,
  exceptionNoDelivery?: boolean
): boolean {
  if (exceptionNoDelivery) return false;

  if (vendor === 'farmers') {
    return dayOfWeek === 1; // Monday only
  }
  // marketbom
  return dayOfWeek === 2 || dayOfWeek === 4; // Tuesday, Thursday
}

/**
 * Get the previous order day that would generate today's inbound.
 * Farmers Mon(1) <- Sun(0)
 * Marketbom Tue(2) <- Sun(0), Thu(4) <- Tue(2)
 */
function getPreviousOrderDay(vendor: Vendor, dayOfWeek: number): number | null {
  if (vendor === 'farmers') {
    if (dayOfWeek === 1) return 0; // Mon <- Sun
  } else {
    if (dayOfWeek === 2) return 0; // Tue <- Sun
    if (dayOfWeek === 4) return 2; // Thu <- Tue
  }
  return null;
}

/**
 * Compute the date string of the previous relevant order day.
 */
function getPreviousOrderDate(currentDate: string, vendor: Vendor, dayOfWeek: number): string | null {
  const prevDay = getPreviousOrderDay(vendor, dayOfWeek);
  if (prevDay === null) return null;

  const current = new Date(currentDate + 'T00:00:00');
  let diff = dayOfWeek - prevDay;
  if (diff <= 0) diff += 7;

  const prevDate = new Date(current);
  prevDate.setDate(current.getDate() - diff);
  return prevDate.toISOString().split('T')[0];
}

/**
 * Auto-fill inbound quantities from the previous relevant order.
 * Returns a map of itemId -> previous order quantity.
 */
export function getAutoInboundFromPrevOrder(
  currentDate: string,
  vendor: Vendor,
  dayOfWeek: number
): Record<string, number> {
  const prevDate = getPreviousOrderDate(currentDate, vendor, dayOfWeek);
  if (!prevDate) return {};

  const result: Record<string, number> = {};

  // Check automation records first
  const autoRecords = loadAutomationRecords().filter(
    r => r.date === prevDate && r.vendor === vendor
  );
  if (autoRecords.length > 0) {
    for (const item of autoRecords[0].items) {
      if (item.finalOrder > 0) {
        result[item.itemId] = item.finalOrder;
      }
    }
    return result;
  }

  // Fall back to regular records
  const records = loadRecords().filter(
    r => r.date === prevDate && r.vendor === vendor
  );
  if (records.length > 0) {
    for (const item of records[0].items) {
      const orderAmt = Number(item.order) || 0;
      if (orderAmt > 0) {
        result[item.itemId] = orderAmt;
      }
    }
  }

  return result;
}
