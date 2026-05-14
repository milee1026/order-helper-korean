import { DailyRecord, AppSettings } from '@/types';
import { getItemById, ALL_ITEMS } from '@/config/items';
import { getKstDateString, shiftKstDateString } from '@/utils/date';
import { readCompatibleInbound, readCompatibleTotalStock } from '@/utils/recordCompatibility';

interface ItemStats {
  itemId: string;
  itemName: string;
  category: string;
  orderCount: number;
  orderQuantities: number[];
  orderQuantitiesByDay: Record<number, number[]>;
  totalStocks: number[];
  inboundQuantities: number[];
}

export function computeAnalysis(records: DailyRecord[], settings: AppSettings) {
  const statsMap = new Map<string, ItemStats>();

  for (const rec of records) {
    for (const item of rec.items) {
      const cfg = getItemById(item.itemId);
      if (!cfg) continue;
      if (!statsMap.has(item.itemId)) {
        statsMap.set(item.itemId, {
          itemId: item.itemId, itemName: cfg.name, category: cfg.category,
          orderCount: 0, orderQuantities: [], orderQuantitiesByDay: {},
          totalStocks: [], inboundQuantities: [],
        });
      }
      const st = statsMap.get(item.itemId)!;
      const orderAmt = Number(item.order) || 0;
      const inboundAmt = Number(readCompatibleInbound(item)) || 0;
      const total = readCompatibleTotalStock(item, cfg, settings);

      if (orderAmt > 0) {
        st.orderCount++;
        st.orderQuantities.push(orderAmt);
        if (!st.orderQuantitiesByDay[rec.orderDay]) st.orderQuantitiesByDay[rec.orderDay] = [];
        st.orderQuantitiesByDay[rec.orderDay].push(orderAmt);
      }
      if (total != null) st.totalStocks.push(total);
      if (inboundAmt > 0) st.inboundQuantities.push(inboundAmt);
    }
  }

  return Array.from(statsMap.values()).map(st => ({
    ...st,
    avgOrder: avg(st.orderQuantities),
    modeOrder: mode(st.orderQuantities),
    avgStock: avg(st.totalStocks),
    minStock: st.totalStocks.length ? Math.min(...st.totalStocks) : 0,
    maxStock: st.totalStocks.length ? Math.max(...st.totalStocks) : 0,
    medianStock: median(st.totalStocks),
    avgInbound: avg(st.inboundQuantities),
    modeOrderByDay: Object.fromEntries(
      Object.entries(st.orderQuantitiesByDay).map(([d, vals]) => [d, mode(vals)])
    ),
    avgOrderByDay: Object.fromEntries(
      Object.entries(st.orderQuantitiesByDay).map(([d, vals]) => [d, avg(vals)])
    ),
    defaultOrderCandidate: computeDefaultOrder(st),
    minThresholdCandidate: median(st.totalStocks),
  }));
}

function computeDefaultOrder(st: ItemStats): number {
  const byDayModes = Object.values(st.orderQuantitiesByDay).map(vals => mode(vals));
  const m = mode(byDayModes.filter(v => v > 0));
  return m > 0 ? m : avg(st.orderQuantities);
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

export function filterRecordsByWeeks(records: DailyRecord[], weeks: number): DailyRecord[] {
  const cutoffStr = shiftKstDateString(getKstDateString(), -(weeks * 7));
  return records.filter(r => r.date >= cutoffStr);
}
