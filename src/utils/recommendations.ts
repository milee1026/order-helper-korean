import { DailyRecord, AppSettings, AutomationRecord } from '@/types';
import { getCoverDays } from '@/config/ordering';
import { getKstDateString, shiftKstDateString } from '@/utils/date';

interface ItemRecommendation {
  defaultOrderCandidate: number;
  minThresholdCandidate: number;
  medianOrderCandidate: number;
  trainingRecordCount: number;
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
  medianOrderCandidate: number;
  minThresholdCandidate: number;
  totalStockSampleCount: number;
}

export interface RecommendationAdjustment {
  label: string;
  reason: string;
}

export interface SafetyRecommendationOptions {
  medianOrderCandidate?: number;
  trainingRecordCount?: number;
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
    const medianOrderCandidate = st.orderQuantities.length > 0 ? median(st.orderQuantities) : 0;
    const minThreshold = st.totalStocks.length > 0 ? median(st.totalStocks) : 0;

    result[itemId] = {
      defaultOrderCandidate: defaultCandidate,
      minThresholdCandidate: minThreshold,
      medianOrderCandidate,
      trainingRecordCount: st.orderQuantities.length,
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
        medianOrderCandidate: 0,
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
    const medianOrderCandidate = st.orderQuantities.length > 0 ? median(st.orderQuantities) : 0;
    const minThreshold = st.totalStocks.length > 0 ? median(st.totalStocks) : 0;

    audit.estimatedDailyUsage = estimatedDailyUsage;
    audit.averageOrderCandidate = defaultCandidate;
    audit.medianOrderCandidate = medianOrderCandidate;
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
  carryOverRatio: number;
  recommendationByDemand: number;
  averageFloorCandidate: number;
  medianFloorCandidate: number;
  categoryMinimumCandidate: number;
  floorWeight: number;
  floorStatus: string;
  recommendationRawBeforeRounding: number;
  recommendedRaw: number;
  appliedAdjustments: RecommendationAdjustment[];
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
    const carryOverStock = Math.max(0, currentStock);
    return {
      estimatedDailyUsage: 0,
      estimatedPreInboundConsumption: 0,
      postInboundCoverNeed: 0,
      carryOverStock,
      carryOverRatio: 1,
      recommendationByDemand: 0,
      averageFloorCandidate: 0,
      medianFloorCandidate: 0,
      categoryMinimumCandidate: 0,
      floorWeight: 0,
      floorStatus: '평균발주량이 없어 하한 보정을 적용하지 않음',
      recommendationRawBeforeRounding: 0,
      recommendedRaw: 0,
      appliedAdjustments: [],
    };
  }

  // 기록 기반 평균 발주량을 커버일수로 나눈 추정 일평균 사용량입니다.
  const estimatedDailyUsage = defaultOrderCandidate / safeDefaultDays;

  const estimatedPreInboundConsumption = estimatedDailyUsage * safeLeadDays;
  const carryOverStock = Math.max(0, currentStock - estimatedPreInboundConsumption);

  const postInboundCoverNeed = estimatedDailyUsage * safeCoverDays;
  const recommendationByDemand = Math.max(0, postInboundCoverNeed - carryOverStock);
  const carryOverRatio = postInboundCoverNeed > 0 ? carryOverStock / postInboundCoverNeed : 1;

  return {
    estimatedDailyUsage,
    estimatedPreInboundConsumption,
    postInboundCoverNeed,
    carryOverStock,
    carryOverRatio,
    recommendationByDemand,
    averageFloorCandidate: 0,
    medianFloorCandidate: 0,
    categoryMinimumCandidate: 0,
    floorWeight: 0,
    floorStatus: '기본 수요 계산만 적용',
    recommendationRawBeforeRounding: recommendationByDemand,
    recommendedRaw: recommendationByDemand,
    appliedAdjustments: [],
  };
}

export function buildSafeCoverageRecommendationPlan(
  itemId: string,
  currentStock: number,
  defaultOrderCandidate: number,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0,
  options: SafetyRecommendationOptions = {}
): CoverageRecommendationPlan {
  const base = buildCoverageRecommendationPlan(
    currentStock,
    defaultOrderCandidate,
    coverDaysCount,
    defaultCoverDaysCount,
    leadDaysCount
  );
  const policy = getItemSafetyPolicy(itemId);
  const medianOrderCandidate = Math.max(0, Number(options.medianOrderCandidate) || 0);
  const trainingRecordCount = Math.max(0, Number(options.trainingRecordCount) || 0);
  const appliedAdjustments: RecommendationAdjustment[] = [];

  if (base.postInboundCoverNeed <= 0 || base.recommendationByDemand <= 0) {
    return {
      ...base,
      floorStatus: '입고 후 커버 필요량이 없어 하한 보정을 적용하지 않음',
      appliedAdjustments,
    };
  }

  const floorWeight = getFloorWeight(base.carryOverRatio);
  const floorStatus = getFloorStatus(base.carryOverRatio, floorWeight);

  if (floorWeight <= 0) {
    appliedAdjustments.push({
      label: '하한 해제',
      reason: 'carryOver가 입고 후 커버 필요량을 충분히 덮어 평균/중앙값/최소 하한을 모두 끔',
    });
    return {
      ...base,
      floorWeight,
      floorStatus,
      appliedAdjustments,
    };
  }

  const averageFloorBase = defaultOrderCandidate > 0 ? defaultOrderCandidate * policy.floorRatio : 0;
  const medianFloorBase = medianOrderCandidate > 0 ? medianOrderCandidate * policy.medianFloorRatio : 0;
  const averageFloorCandidate = softenFloorCandidate(base.recommendationByDemand, averageFloorBase, floorWeight);
  const medianFloorCandidate = softenFloorCandidate(base.recommendationByDemand, medianFloorBase, floorWeight);
  const categoryMinimumBase = getCategoryMinimumCandidate(itemId, policy, {
    averageOrderCandidate: defaultOrderCandidate,
    medianOrderCandidate,
    trainingRecordCount,
    coverDaysCount: Number.isFinite(coverDaysCount) && coverDaysCount > 0 ? coverDaysCount : defaultCoverDaysCount,
    carryOverRatio: base.carryOverRatio,
    postInboundCoverNeed: base.postInboundCoverNeed,
  });
  const categoryMinimumCandidate = softenFloorCandidate(base.recommendationByDemand, categoryMinimumBase, floorWeight);

  let recommendationRawBeforeRounding = Math.max(
    base.recommendationByDemand,
    averageFloorCandidate,
    medianFloorCandidate,
    categoryMinimumCandidate
  );

  if (averageFloorCandidate > base.recommendationByDemand) {
    appliedAdjustments.push({
      label: '평균 하한 적용',
      reason: `${policy.name} floorRatio ${policy.floorRatio} 기준, carryOver 상태에 따라 약하게 반영`,
    });
  }
  if (medianFloorCandidate > Math.max(base.recommendationByDemand, averageFloorCandidate)) {
    appliedAdjustments.push({
      label: '중앙값 하한 적용',
      reason: `${policy.name} medianFloorRatio ${policy.medianFloorRatio} 기준, 최근 정상 중앙값 반영`,
    });
  }
  if (categoryMinimumCandidate > Math.max(base.recommendationByDemand, averageFloorCandidate, medianFloorCandidate)) {
    appliedAdjustments.push({
      label: '최소 안전 추천 적용',
      reason: '학습 기록이 충분하고 carryOver가 낮아 제한적 최소 안전 추천값을 반영',
    });
  }

  recommendationRawBeforeRounding = Math.max(0, recommendationRawBeforeRounding);

  return {
    ...base,
    averageFloorCandidate,
    medianFloorCandidate,
    categoryMinimumCandidate,
    floorWeight,
    floorStatus,
    recommendationRawBeforeRounding,
    recommendedRaw: recommendationRawBeforeRounding,
    appliedAdjustments,
  };
}

export function computeRecommendedOrder(
  itemId: string,
  currentStock: number,
  defaultOrderCandidate: number,
  minThresholdCandidate: number,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0,
  options: SafetyRecommendationOptions = {}
): number {
  void minThresholdCandidate;
  return buildSafeCoverageRecommendationPlan(
    itemId,
    currentStock,
    defaultOrderCandidate,
    coverDaysCount,
    defaultCoverDaysCount,
    leadDaysCount,
    options
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

interface ItemSafetyPolicy {
  name: string;
  floorRatio: number;
  medianFloorRatio: number;
  categoryMinimum: number;
  allowCategoryMinimum: boolean;
}

function getItemSafetyPolicy(itemId: string): ItemSafetyPolicy {
  if (['m-beef', 'm-pork', 'm-chicken'].includes(itemId)) {
    return { name: '고기류', floorRatio: 1, medianFloorRatio: 1, categoryMinimum: 1, allowCategoryMinimum: true };
  }
  if (itemId.startsWith('ms-')) {
    const isBoxSauce = ['ms-salpa', 'ms-rose', 'ms-curry'].includes(itemId);
    return { name: '소스류', floorRatio: 1, medianFloorRatio: 0.95, categoryMinimum: isBoxSauce ? 1 : 2, allowCategoryMinimum: true };
  }
  if (itemId.startsWith('mr-')) {
    return { name: '냉장제품', floorRatio: 0.95, medianFloorRatio: 0.9, categoryMinimum: 1, allowCategoryMinimum: true };
  }
  if (itemId.startsWith('mf-')) {
    return { name: '냉동제품', floorRatio: 1, medianFloorRatio: 0.95, categoryMinimum: 1, allowCategoryMinimum: true };
  }
  if (itemId.startsWith('mp-')) {
    return { name: '포장용품', floorRatio: 1, medianFloorRatio: 0.95, categoryMinimum: 1, allowCategoryMinimum: true };
  }
  if (itemId.startsWith('mo-')) {
    return { name: '비품류', floorRatio: 0.9, medianFloorRatio: 0.85, categoryMinimum: 0, allowCategoryMinimum: false };
  }
  if (itemId.startsWith('f-')) {
    return { name: '파머스 품목', floorRatio: 0.95, medianFloorRatio: 0.9, categoryMinimum: getFarmersMinimumOrder(itemId), allowCategoryMinimum: true };
  }
  return { name: '기타 품목', floorRatio: 0.95, medianFloorRatio: 0.9, categoryMinimum: 0, allowCategoryMinimum: false };
}

function getFarmersMinimumOrder(itemId: string): number {
  switch (itemId) {
    case 'f-salad':
      return 2;
    case 'f-broccoli':
      return 4;
    case 'f-paprika':
      return 5;
    case 'f-chive':
      return 1;
    default:
      return 0;
  }
}

function getFloorWeight(carryOverRatio: number): number {
  if (!Number.isFinite(carryOverRatio)) return 1;
  if (carryOverRatio >= 1) return 0;
  if (carryOverRatio <= 0.15) return 1;
  if (carryOverRatio >= 0.85) return 0;
  return Math.max(0, Math.min(1, (0.85 - carryOverRatio) / 0.7));
}

function getFloorStatus(carryOverRatio: number, floorWeight: number): string {
  if (floorWeight <= 0) return 'carryOver 충분: 평균/중앙값/최소 하한 해제';
  if (carryOverRatio <= 0.15) return 'carryOver 낮음: 평균/중앙값 하한 적용';
  return 'carryOver 일부 있음: 평균/중앙값 하한 약하게 적용';
}

function softenFloorCandidate(demandCandidate: number, floorCandidate: number, floorWeight: number): number {
  if (floorCandidate <= 0 || floorCandidate <= demandCandidate) return Math.max(0, floorCandidate);
  if (floorCandidate - demandCandidate <= 0.25) return demandCandidate;
  if (floorWeight <= 0) return demandCandidate;
  return demandCandidate + (floorCandidate - demandCandidate) * floorWeight;
}

function getCategoryMinimumCandidate(
  itemId: string,
  policy: ItemSafetyPolicy,
  context: {
    averageOrderCandidate: number;
    medianOrderCandidate: number;
    trainingRecordCount: number;
    coverDaysCount: number;
    carryOverRatio: number;
    postInboundCoverNeed: number;
  }
): number {
  if (!policy.allowCategoryMinimum || policy.categoryMinimum <= 0) return 0;
  if (context.postInboundCoverNeed <= 0) return 0;
  if (context.carryOverRatio > 0.15) return 0;
  if (context.trainingRecordCount < 2) return 0;
  const reference = Math.max(context.averageOrderCandidate, context.medianOrderCandidate);
  if (reference < 1) return 0;
  if (policy.name === '소스류' && policy.categoryMinimum >= 2) {
    if (context.coverDaysCount < 3 || reference < 2) return 0;
  }
  if (itemId.startsWith('f-') && reference < policy.categoryMinimum) return 0;
  return policy.categoryMinimum;
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
