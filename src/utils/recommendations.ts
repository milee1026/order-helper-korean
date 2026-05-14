import { DailyRecord, AppSettings, AutomationRecord } from '@/types';
import { getCoverDays } from '@/config/ordering';
import { getKstDateString, shiftKstDateString } from '@/utils/date';

interface ItemRecommendation {
  defaultOrderCandidate: number;
  minThresholdCandidate: number;
  avgOrderByDay: Record<number, number>;
  modeOrderByDay: Record<number, number>;
}

export interface RecommendationTrainingEntry {
  source: 'automation' | 'today';
  date: string;
  vendor: 'farmers' | 'marketbom';
  orderDay: number;
  coverDays: string[];
  coverDaysCount: number;
  valueType: 'finalOrder' | 'order';
  value: number;
  estimatedDailyUsage: number;
}

export interface RecommendationTrainingExclusion {
  source: 'automation' | 'today';
  date: string;
  vendor: 'farmers' | 'marketbom';
  orderDay: number;
  coverDays: string[];
  coverDaysCount: number;
  reason: string;
  valueType?: 'finalOrder' | 'order';
  value?: number;
}

export interface RecommendationAudit {
  itemId: string;
  cutoffDate: string;
  defaultCoverDaysCount: number;
  usedRecords: RecommendationTrainingEntry[];
  excludedRecords: RecommendationTrainingExclusion[];
  estimatedDailyUsage: number;
  averageOrderCandidate: number;
  minThresholdCandidate: number;
  totalStockSampleCount: number;
}

export function getRecommendations(
  records: DailyRecord[],
  vendor: 'farmers' | 'marketbom',
  orderDay: number,
  _settings: AppSettings,
  automationRecords: AutomationRecord[] = []
): Record<string, ItemRecommendation> {
  const result: Record<string, ItemRecommendation> = {};
  const cutoffDate = shiftKstDateString(getKstDateString(), -28);
  const currentDefaultCoverDays = countCoverDays(getCoverDays(vendor, orderDay)) || 1;

  const statsMap = new Map<string, {
    orderQuantities: number[];
    orderByDay: Record<number, number[]>;
    totalStocks: number[];
    estimatedDailyUsages: number[];
  }>();

  const ensureStats = (itemId: string) => {
    if (!statsMap.has(itemId)) {
      statsMap.set(itemId, { orderQuantities: [], orderByDay: {}, totalStocks: [], estimatedDailyUsages: [] });
    }
    return statsMap.get(itemId)!;
  };

  const automationFinalOrderKeys = new Set<string>();

  for (const rec of automationRecords) {
    if (rec.vendor !== vendor || rec.date < cutoffDate || !isNormalTrainingRecord(rec.vendor, rec.orderDay, rec.coverDays)) {
      continue;
    }

    const coverDaysCount = rec.coverDays.length;
    for (const item of rec.items) {
      const finalOrder = Number(item.finalOrder) || 0;
      if (finalOrder <= 0) continue;

      const st = ensureStats(item.itemId);
      st.orderQuantities.push(finalOrder);
      st.estimatedDailyUsages.push(finalOrder / coverDaysCount);
      if (!st.orderByDay[rec.orderDay]) st.orderByDay[rec.orderDay] = [];
      st.orderByDay[rec.orderDay].push(finalOrder);
      automationFinalOrderKeys.add(trainingKey(rec.date, rec.vendor, item.itemId));
    }
  }

  for (const rec of records) {
    if (rec.vendor !== vendor || rec.date < cutoffDate || !isNormalTrainingRecord(rec.vendor, rec.orderDay, rec.coverDays)) {
      continue;
    }

    const coverDaysCount = rec.coverDays.length;
    for (const item of rec.items) {
      const st = ensureStats(item.itemId);
      const orderAmt = Number(item.order) || 0;
      const hasAutomationFinalOrder = automationFinalOrderKeys.has(trainingKey(rec.date, rec.vendor, item.itemId));
      if (orderAmt > 0 && !hasAutomationFinalOrder) {
        st.orderQuantities.push(orderAmt);
        st.estimatedDailyUsages.push(orderAmt / coverDaysCount);
        if (!st.orderByDay[rec.orderDay]) st.orderByDay[rec.orderDay] = [];
        st.orderByDay[rec.orderDay].push(orderAmt);
      }
      const total = Number(item.totalStock) || 0;
      if (total > 0) st.totalStocks.push(total);
    }
  }

  for (const [itemId, st] of statsMap) {
    const dayOrders = st.orderByDay[orderDay] || [];
    const estimatedDailyUsage = avg(st.estimatedDailyUsages);
    const defaultCandidate = estimatedDailyUsage > 0
      ? estimatedDailyUsage * currentDefaultCoverDays
      : (dayOrders.length > 0 ? mode(dayOrders) : (st.orderQuantities.length > 0 ? mode(st.orderQuantities) : 0));
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

export function getRecommendationAudits(
  records: DailyRecord[],
  vendor: 'farmers' | 'marketbom',
  orderDay: number,
  automationRecords: AutomationRecord[] = []
): Record<string, RecommendationAudit> {
  const result: Record<string, RecommendationAudit> = {};
  const cutoffDate = shiftKstDateString(getKstDateString(), -28);
  const currentDefaultCoverDays = countCoverDays(getCoverDays(vendor, orderDay)) || 1;

  const statsMap = new Map<string, {
    orderQuantities: number[];
    orderByDay: Record<number, number[]>;
    totalStocks: number[];
    estimatedDailyUsages: number[];
  }>();

  const ensureStats = (itemId: string) => {
    if (!statsMap.has(itemId)) {
      statsMap.set(itemId, { orderQuantities: [], orderByDay: {}, totalStocks: [], estimatedDailyUsages: [] });
    }
    return statsMap.get(itemId)!;
  };

  const ensureAudit = (itemId: string) => {
    if (!result[itemId]) {
      result[itemId] = {
        itemId,
        cutoffDate,
        defaultCoverDaysCount: currentDefaultCoverDays,
        usedRecords: [],
        excludedRecords: [],
        estimatedDailyUsage: 0,
        averageOrderCandidate: 0,
        minThresholdCandidate: 0,
        totalStockSampleCount: 0,
      };
    }
    return result[itemId];
  };

  const automationFinalOrderKeys = new Set<string>();

  for (const rec of automationRecords) {
    if (rec.vendor !== vendor || rec.date < cutoffDate) {
      continue;
    }

    const recordReason = getTrainingRecordExclusionReason(rec.vendor, rec.orderDay, rec.coverDays);
    if (recordReason) {
      for (const item of rec.items) {
        ensureAudit(item.itemId).excludedRecords.push({
          source: 'automation',
          date: rec.date,
          vendor: rec.vendor,
          orderDay: rec.orderDay,
          coverDays: Array.isArray(rec.coverDays) ? rec.coverDays : [],
          coverDaysCount: Array.isArray(rec.coverDays) ? rec.coverDays.length : 0,
          reason: recordReason,
          valueType: 'finalOrder',
          value: Number(item.finalOrder) || 0,
        });
      }
      continue;
    }

    const coverDaysCount = rec.coverDays.length;
    for (const item of rec.items) {
      const finalOrder = Number(item.finalOrder);
      const audit = ensureAudit(item.itemId);
      if (!Number.isFinite(finalOrder) || finalOrder <= 0) {
        audit.excludedRecords.push({
          source: 'automation',
          date: rec.date,
          vendor: rec.vendor,
          orderDay: rec.orderDay,
          coverDays: rec.coverDays,
          coverDaysCount,
          reason: getValueExclusionReason(item.finalOrder, 'finalOrder'),
          valueType: 'finalOrder',
          value: Number.isFinite(finalOrder) ? finalOrder : undefined,
        });
        continue;
      }

      const st = ensureStats(item.itemId);
      const estimatedDailyUsage = finalOrder / coverDaysCount;
      st.orderQuantities.push(finalOrder);
      st.estimatedDailyUsages.push(estimatedDailyUsage);
      if (!st.orderByDay[rec.orderDay]) st.orderByDay[rec.orderDay] = [];
      st.orderByDay[rec.orderDay].push(finalOrder);
      automationFinalOrderKeys.add(trainingKey(rec.date, rec.vendor, item.itemId));
      audit.usedRecords.push({
        source: 'automation',
        date: rec.date,
        vendor: rec.vendor,
        orderDay: rec.orderDay,
        coverDays: rec.coverDays,
        coverDaysCount,
        valueType: 'finalOrder',
        value: finalOrder,
        estimatedDailyUsage,
      });
    }
  }

  for (const rec of records) {
    if (rec.vendor !== vendor || rec.date < cutoffDate) {
      continue;
    }

    const recordReason = getTrainingRecordExclusionReason(rec.vendor, rec.orderDay, rec.coverDays);
    if (recordReason) {
      for (const item of rec.items) {
        ensureAudit(item.itemId).excludedRecords.push({
          source: 'today',
          date: rec.date,
          vendor: rec.vendor,
          orderDay: rec.orderDay,
          coverDays: Array.isArray(rec.coverDays) ? rec.coverDays : [],
          coverDaysCount: Array.isArray(rec.coverDays) ? rec.coverDays.length : 0,
          reason: recordReason,
          valueType: 'order',
          value: Number(item.order) || 0,
        });
      }
      continue;
    }

    const coverDaysCount = rec.coverDays.length;
    for (const item of rec.items) {
      const audit = ensureAudit(item.itemId);
      const st = ensureStats(item.itemId);
      const orderAmt = Number(item.order);
      const hasAutomationFinalOrder = automationFinalOrderKeys.has(trainingKey(rec.date, rec.vendor, item.itemId));
      if (orderAmt > 0 && !hasAutomationFinalOrder) {
        const estimatedDailyUsage = orderAmt / coverDaysCount;
        st.orderQuantities.push(orderAmt);
        st.estimatedDailyUsages.push(estimatedDailyUsage);
        if (!st.orderByDay[rec.orderDay]) st.orderByDay[rec.orderDay] = [];
        st.orderByDay[rec.orderDay].push(orderAmt);
        audit.usedRecords.push({
          source: 'today',
          date: rec.date,
          vendor: rec.vendor,
          orderDay: rec.orderDay,
          coverDays: rec.coverDays,
          coverDaysCount,
          valueType: 'order',
          value: orderAmt,
          estimatedDailyUsage,
        });
      } else {
        audit.excludedRecords.push({
          source: 'today',
          date: rec.date,
          vendor: rec.vendor,
          orderDay: rec.orderDay,
          coverDays: rec.coverDays,
          coverDaysCount,
          reason: hasAutomationFinalOrder ? '자동화 finalOrder 우선 사용' : getValueExclusionReason(item.order, 'order'),
          valueType: 'order',
          value: Number.isFinite(orderAmt) ? orderAmt : undefined,
        });
      }

      const total = Number(item.totalStock) || 0;
      if (total > 0) st.totalStocks.push(total);
    }
  }

  for (const [itemId, st] of statsMap) {
    const audit = ensureAudit(itemId);
    const dayOrders = st.orderByDay[orderDay] || [];
    const estimatedDailyUsage = avg(st.estimatedDailyUsages);
    const defaultCandidate = estimatedDailyUsage > 0
      ? estimatedDailyUsage * currentDefaultCoverDays
      : (dayOrders.length > 0 ? mode(dayOrders) : (st.orderQuantities.length > 0 ? mode(st.orderQuantities) : 0));
    const minThreshold = st.totalStocks.length > 0 ? median(st.totalStocks) : 0;

    audit.estimatedDailyUsage = estimatedDailyUsage;
    audit.averageOrderCandidate = defaultCandidate;
    audit.minThresholdCandidate = minThreshold;
    audit.totalStockSampleCount = st.totalStocks.length;
  }

  return result;
}

export interface CoverageRecommendationPlan {
  estimatedDailyUsage: number;
  estimatedPreInboundConsumption: number;
  postInboundCoverNeed: number;
  carryOverStock: number;
  recommendedRaw: number;
}

export function buildCoverageRecommendationPlan(
  currentStock: number,
  defaultOrderCandidate: number,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0
): CoverageRecommendationPlan {
  const safeDefaultDays = Number.isFinite(defaultCoverDaysCount) && defaultCoverDaysCount > 0 ? defaultCoverDaysCount : 1;
  const safeCoverDays = Number.isFinite(coverDaysCount) && coverDaysCount > 0 ? coverDaysCount : safeDefaultDays;
  const safeLeadDays = Number.isFinite(leadDaysCount) && leadDaysCount > 0 ? leadDaysCount : 0;

  if (defaultOrderCandidate <= 0) {
    return {
      estimatedDailyUsage: 0,
      estimatedPreInboundConsumption: 0,
      postInboundCoverNeed: 0,
      carryOverStock: Math.max(0, currentStock),
      recommendedRaw: 0,
    };
  }

  // 기록 기반 평균 발주량을 커버일수로 나눈 추정 일평균 사용량입니다.
  const estimatedDailyUsage = defaultOrderCandidate / safeDefaultDays;

  const estimatedPreInboundConsumption = estimatedDailyUsage * safeLeadDays;
  const carryOverStock = Math.max(0, currentStock - estimatedPreInboundConsumption);

  const postInboundCoverNeed = estimatedDailyUsage * safeCoverDays;

  return {
    estimatedDailyUsage,
    estimatedPreInboundConsumption,
    postInboundCoverNeed,
    carryOverStock,
    recommendedRaw: Math.max(0, postInboundCoverNeed - carryOverStock),
  };
}

export function computeRecommendedOrder(
  currentStock: number,
  defaultOrderCandidate: number,
  minThresholdCandidate: number,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0
): number {
  void minThresholdCandidate;
  return buildCoverageRecommendationPlan(
    currentStock,
    defaultOrderCandidate,
    coverDaysCount,
    defaultCoverDaysCount,
    leadDaysCount
  ).recommendedRaw;
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

function countCoverDays(value: string): number {
  return value
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean)
    .length;
}

function isNormalTrainingRecord(vendor: 'farmers' | 'marketbom', orderDay: number, coverDays: string[]): boolean {
  if (!Array.isArray(coverDays) || coverDays.length <= 0) return false;
  const defaultCoverDaysCount = countCoverDays(getCoverDays(vendor, orderDay));
  if (defaultCoverDaysCount <= 0) return false;
  return coverDays.length <= defaultCoverDaysCount;
}

function getTrainingRecordExclusionReason(vendor: 'farmers' | 'marketbom', orderDay: number, coverDays: string[]): string | null {
  if (!Array.isArray(coverDays)) return '커버일 없음';
  if (coverDays.length <= 0) return '커버일 0';
  const defaultCoverDaysCount = countCoverDays(getCoverDays(vendor, orderDay));
  if (defaultCoverDaysCount <= 0) return '기본 커버일 없음';
  if (coverDays.length > defaultCoverDaysCount) return '기본 커버일보다 긴 예외성 기록';
  return null;
}

function getValueExclusionReason(value: unknown, fieldName: 'finalOrder' | 'order'): string {
  if (value === undefined || value === null || value === '') return `${fieldName} 없음`;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '값이 0 또는 비정상';
  return `${fieldName} 없음`;
}

function trainingKey(date: string, vendor: string, itemId: string): string {
  return `${date}__${vendor}__${itemId}`;
}
