import { DailyRecord, AppSettings } from '@/types';
import { getItemById } from '@/config/items';

interface ItemRecommendation {
  defaultOrderCandidate: number;
  minThresholdCandidate: number;
  avgOrderByDay: Record<number, number>;
  modeOrderByDay: Record<number, number>;
}

export function getRecommendations(
  records: DailyRecord[],
  vendor: 'farmers' | 'marketbom',
  orderDay: number,
  _settings: AppSettings
): Record<string, ItemRecommendation> {
  const result: Record<string, ItemRecommendation> = {};
  const vendorRecords = records.filter(r => r.vendor === vendor);

  // Collect per-item stats
  const statsMap = new Map<string, {
    orderQuantities: number[];
    orderByDay: Record<number, number[]>;
    totalStocks: number[];
  }>();

  for (const rec of vendorRecords) {
    for (const item of rec.items) {
      if (!statsMap.has(item.itemId)) {
        statsMap.set(item.itemId, { orderQuantities: [], orderByDay: {}, totalStocks: [] });
      }
      const st = statsMap.get(item.itemId)!;
      const orderAmt = Number(item.order) || 0;
      if (orderAmt > 0) {
        st.orderQuantities.push(orderAmt);
        if (!st.orderByDay[rec.orderDay]) st.orderByDay[rec.orderDay] = [];
        st.orderByDay[rec.orderDay].push(orderAmt);
      }
      const total = Number(item.totalStock) || 0;
      if (total > 0) st.totalStocks.push(total);
    }
  }

  for (const [itemId, st] of statsMap) {
    const dayOrders = st.orderByDay[orderDay] || [];
    const defaultCandidate = dayOrders.length > 0
      ? mode(dayOrders)
      : (st.orderQuantities.length > 0 ? mode(st.orderQuantities) : 0);
    const minThreshold = st.totalStocks.length > 0 ? median(st.totalStocks) : 0;

    result[itemId] = {
      defaultOrderCandidate: defaultCandidate,
      minThresholdCandidate: minThreshold,
      avgOrderByDay: Object.fromEntries(
        Object.entries(st.orderByDay).map(([d, vals]) => [d, avg(vals)])
      ),
      modeOrderByDay: Object.fromEntries(
        Object.entries(st.orderByDay).map(([d, vals]) => [d, mode(vals)])
      ),
    };
  }

  return result;
}

export function computeRecommendedOrder(
  currentStock: number,
  defaultOrderCandidate: number,
  minThresholdCandidate: number
): number {
  if (defaultOrderCandidate <= 0) return 0;
  if (currentStock <= minThresholdCandidate) return defaultOrderCandidate;
  // Stock is above threshold - suggest reduced or zero
  if (currentStock > minThresholdCandidate * 1.5) return 0;
  return Math.max(0, Math.round(defaultOrderCandidate * 0.5));
}

export function getStockStatus(
  currentStock: number,
  minThresholdCandidate: number
): '부족' | '보통' | '많음' {
  if (minThresholdCandidate <= 0) return '보통';
  if (currentStock < minThresholdCandidate * 0.7) return '부족';
  if (currentStock > minThresholdCandidate * 1.5) return '많음';
  return '보통';
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(arr: number[]): number {
  if (!arr.length) return 0;
  const freq = new Map<number, number>();
  for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  let maxCount = 0, result = 0;
  for (const [val, count] of freq) {
    if (count > maxCount) { maxCount = count; result = val; }
  }
  return result;
}
