import { DailyRecord, AppSettings, AutomationRecord } from '@/types';
import { getCoverDays, getLeadDays } from '@/config/ordering';
import { getItemById } from '@/config/items';
import { getKstDateString, shiftKstDateString } from '@/utils/date';
import { convertStockToOrderUnits } from '@/utils/itemUnits';
import { readCompatibleTotalStock } from '@/utils/recordCompatibility';

interface ItemRecommendation {
  defaultOrderCandidate: number;
  minThresholdCandidate: number;
  medianOrderCandidate: number;
  trainingRecordCount: number;
  learnedTargetCoverStock: number;
  averageTargetCoverStock: number;
  targetFallbackLevel: number;
  targetFallbackLabel: string;
  targetConfidence: string;
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

export interface RecommendationTargetCandidate {
  id: string;
  source: 'automation' | 'today';
  date: string;
  vendor: 'farmers' | 'marketbom';
  orderDay: number;
  coverDays: string[];
  coverDaysCount: number;
  valueType: 'finalOrder' | 'order';
  historicalFinalOrder: number;
  historicalCurrentStock: number;
  historicalEstimatedDailyUsage: number;
  historicalPreInboundExpectedConsumption: number;
  historicalCarryOver: number;
  historicalTargetCoverStock: number;
  usedForTarget: boolean;
  excludedReason?: string;
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
  targetCandidates: RecommendationTargetCandidate[];
  learnedTargetCoverStock: number;
  averageTargetCoverStock: number;
  targetFallbackLevel: number;
  targetFallbackLabel: string;
  targetConfidence: string;
  userCoverDays: string[];
  appliedCoverDays: string[];
  appliedCoverDaysCount: number;
}

export interface RecommendationAdjustment {
  label: string;
  reason: string;
}

export interface SafetyRecommendationOptions {
  learnedTargetCoverStock?: number;
  averageTargetCoverStock?: number;
  targetFallbackLevel?: number;
  targetFallbackLabel?: string;
  targetConfidence?: string;
}

export function getRecommendations(
  records: DailyRecord[],
  vendor: 'farmers' | 'marketbom',
  orderDay: number,
  settings: AppSettings,
  automationRecords: AutomationRecord[] = [],
  appliedCoverDaysInput = ''
): Record<string, ItemRecommendation> {
  const result: Record<string, ItemRecommendation> = {};
  const cutoffDate = shiftKstDateString(getKstDateString(), -28);
  const currentDefaultCoverDays = countCoverDays(getCoverDays(vendor, orderDay)) || 1;
  const appliedCoverDays = parseCoverDays(appliedCoverDaysInput || getCoverDays(vendor, orderDay));
  const targetCandidatesByItem = collectTargetCandidates(records, automationRecords, vendor, cutoffDate, settings);

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
    const targetSelection = selectTargetCandidates(targetCandidatesByItem[itemId] || [], vendor, orderDay, appliedCoverDays);

    result[itemId] = {
      defaultOrderCandidate: defaultCandidate,
      minThresholdCandidate: minThreshold,
      medianOrderCandidate,
      trainingRecordCount: st.orderQuantities.length,
      learnedTargetCoverStock: targetSelection.learnedTargetCoverStock,
      averageTargetCoverStock: targetSelection.averageTargetCoverStock,
      targetFallbackLevel: targetSelection.fallbackLevel,
      targetFallbackLabel: targetSelection.fallbackLabel,
      targetConfidence: targetSelection.confidence,
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
  settings: AppSettings,
  automationRecords: AutomationRecord[] = [],
  appliedCoverDaysInput = '',
  userCoverDaysInput = ''
): Record<string, RecommendationAudit> {
  const result: Record<string, RecommendationAudit> = {};
  const cutoffDate = shiftKstDateString(getKstDateString(), -28);
  const currentDefaultCoverDays = countCoverDays(getCoverDays(vendor, orderDay)) || 1;
  const appliedCoverDays = parseCoverDays(appliedCoverDaysInput || getCoverDays(vendor, orderDay));
  const userCoverDays = parseCoverDays(userCoverDaysInput);
  const targetCandidatesByItem = collectTargetCandidates(records, automationRecords, vendor, cutoffDate, settings);

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
        targetCandidates: [],
        learnedTargetCoverStock: 0,
        averageTargetCoverStock: 0,
        targetFallbackLevel: 4,
        targetFallbackLabel: '기존 estimatedDailyUsage 기반 fallback',
        targetConfidence: '임시 추천',
        userCoverDays,
        appliedCoverDays,
        appliedCoverDaysCount: appliedCoverDays.length,
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

  for (const [itemId, candidates] of Object.entries(targetCandidatesByItem)) {
    const audit = ensureAudit(itemId);
    const targetSelection = selectTargetCandidates(candidates, vendor, orderDay, appliedCoverDays);
    const usedIds = new Set(targetSelection.candidates.map(candidate => candidate.id));
    audit.targetCandidates = candidates.map(candidate => ({
      ...candidate,
      usedForTarget: usedIds.has(candidate.id),
    }));
    audit.learnedTargetCoverStock = targetSelection.learnedTargetCoverStock;
    audit.averageTargetCoverStock = targetSelection.averageTargetCoverStock;
    audit.targetFallbackLevel = targetSelection.fallbackLevel;
    audit.targetFallbackLabel = targetSelection.fallbackLabel;
    audit.targetConfidence = targetSelection.confidence;
    audit.userCoverDays = userCoverDays;
    audit.appliedCoverDays = appliedCoverDays;
    audit.appliedCoverDaysCount = appliedCoverDays.length;
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
  learnedTargetCoverStock: number;
  averageTargetCoverStock: number;
  targetFallbackLevel: number;
  targetFallbackLabel: string;
  targetConfidence: string;
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
      learnedTargetCoverStock: 0,
      averageTargetCoverStock: 0,
      targetFallbackLevel: 4,
      targetFallbackLabel: '기존 estimatedDailyUsage 기반 fallback',
      targetConfidence: '임시 추천',
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
    learnedTargetCoverStock: 0,
    averageTargetCoverStock: 0,
    targetFallbackLevel: 4,
    targetFallbackLabel: '기존 estimatedDailyUsage 기반 fallback',
    targetConfidence: '임시 추천',
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
  void itemId;
  const appliedAdjustments: RecommendationAdjustment[] = [];
  const learnedTargetCoverStock = Math.max(0, Number(options.learnedTargetCoverStock) || 0);
  const averageTargetCoverStock = Math.max(0, Number(options.averageTargetCoverStock) || 0);
  const targetFallbackLevel = Number(options.targetFallbackLevel) || 4;
  const targetFallbackLabel = options.targetFallbackLabel || '기존 estimatedDailyUsage 기반 fallback';
  const targetConfidence = options.targetConfidence || '임시 추천';

  if (learnedTargetCoverStock <= 0) {
    return {
      ...base,
      learnedTargetCoverStock: 0,
      averageTargetCoverStock,
      targetFallbackLevel,
      targetFallbackLabel,
      targetConfidence,
      appliedAdjustments: [{
        label: 'target fallback',
        reason: '학습 가능한 targetCoverStock이 없어 기존 수요 기반 계산값을 임시 추천으로 사용',
      }],
    };
  }

  const recommendationRawBeforeRounding = Math.max(0, learnedTargetCoverStock - base.carryOverStock);
  appliedAdjustments.push({
    label: 'targetCoverStock 추천 적용',
    reason: `${targetFallbackLabel} (${targetConfidence}) 기준 learnedTargetCoverStock에서 currentCarryOver만 차감`,
  });

  return {
    ...base,
    learnedTargetCoverStock,
    averageTargetCoverStock,
    targetFallbackLevel,
    targetFallbackLabel,
    targetConfidence,
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

function collectTargetCandidates(
  records: DailyRecord[],
  automationRecords: AutomationRecord[],
  vendor: 'farmers' | 'marketbom',
  cutoffDate: string,
  settings: AppSettings
): Record<string, RecommendationTargetCandidate[]> {
  const result: Record<string, RecommendationTargetCandidate[]> = {};
  const automationFinalOrderKeys = new Set<string>();

  const addCandidate = (itemId: string, candidate: RecommendationTargetCandidate) => {
    if (!result[itemId]) result[itemId] = [];
    result[itemId].push(candidate);
  };

  for (const rec of automationRecords) {
    if (rec.vendor !== vendor || rec.date < cutoffDate) continue;
    const recordReason = getTrainingRecordExclusionReason(rec.vendor, rec.orderDay, rec.coverDays);
    const coverDays = Array.isArray(rec.coverDays) ? rec.coverDays : [];
    const coverDaysCount = coverDays.length;

    for (const item of rec.items) {
      const finalOrder = Number(item.finalOrder);
      const exclusionReason = recordReason || getTargetValueExclusionReason(item.finalOrder, 'finalOrder');
      const currentStock = convertStockToOrderUnits(item.itemId, Number(item.currentStock) || 0, settings);
      const candidate = buildTargetCandidate({
        id: targetCandidateId('automation', rec.date, rec.vendor, item.itemId),
        source: 'automation',
        date: rec.date,
        vendor: rec.vendor,
        orderDay: rec.orderDay,
        coverDays,
        coverDaysCount,
        valueType: 'finalOrder',
        finalOrder: Number.isFinite(finalOrder) ? finalOrder : 0,
        currentStock,
        excludedReason: exclusionReason,
      });
      addCandidate(item.itemId, candidate);
      if (!exclusionReason) {
        automationFinalOrderKeys.add(trainingKey(rec.date, rec.vendor, item.itemId));
      }
    }
  }

  for (const rec of records) {
    if (rec.vendor !== vendor || rec.date < cutoffDate) continue;
    const recordReason = getTrainingRecordExclusionReason(rec.vendor, rec.orderDay, rec.coverDays);
    const coverDays = Array.isArray(rec.coverDays) ? rec.coverDays : [];
    const coverDaysCount = coverDays.length;

    for (const item of rec.items) {
      const order = Number(item.order);
      const hasAutomationFinalOrder = automationFinalOrderKeys.has(trainingKey(rec.date, rec.vendor, item.itemId));
      const exclusionReason = recordReason
        || (hasAutomationFinalOrder ? '자동화 finalOrder 우선 사용' : getTargetValueExclusionReason(item.order, 'order'));
      const config = getItemById(item.itemId);
      const stockValue = config ? readCompatibleTotalStock(item, config, settings) : item.totalStock;
      const currentStock = convertStockToOrderUnits(item.itemId, Number(stockValue) || 0, settings);
      const candidate = buildTargetCandidate({
        id: targetCandidateId('today', rec.date, rec.vendor, item.itemId),
        source: 'today',
        date: rec.date,
        vendor: rec.vendor,
        orderDay: rec.orderDay,
        coverDays,
        coverDaysCount,
        valueType: 'order',
        finalOrder: Number.isFinite(order) ? order : 0,
        currentStock,
        excludedReason: exclusionReason,
      });
      addCandidate(item.itemId, candidate);
    }
  }

  return result;
}

function buildTargetCandidate(input: {
  id: string;
  source: 'automation' | 'today';
  date: string;
  vendor: 'farmers' | 'marketbom';
  orderDay: number;
  coverDays: string[];
  coverDaysCount: number;
  valueType: 'finalOrder' | 'order';
  finalOrder: number;
  currentStock: number;
  excludedReason: string | null;
}): RecommendationTargetCandidate {
  const safeFinalOrder = Math.max(0, Number(input.finalOrder) || 0);
  const safeCoverDaysCount = Math.max(0, Number(input.coverDaysCount) || 0);
  const historicalEstimatedDailyUsage = safeFinalOrder > 0 && safeCoverDaysCount > 0
    ? safeFinalOrder / safeCoverDaysCount
    : 0;
  const historicalPreInboundExpectedConsumption = historicalEstimatedDailyUsage * getLeadDays(input.vendor);
  const historicalCarryOver = Math.max(0, input.currentStock - historicalPreInboundExpectedConsumption);
  const excludedReason = input.excludedReason || (safeFinalOrder <= 0 ? `${input.valueType} 없음` : undefined);
  const historicalTargetCoverStock = excludedReason ? 0 : safeFinalOrder + historicalCarryOver;

  return {
    id: input.id,
    source: input.source,
    date: input.date,
    vendor: input.vendor,
    orderDay: input.orderDay,
    coverDays: input.coverDays,
    coverDaysCount: safeCoverDaysCount,
    valueType: input.valueType,
    historicalFinalOrder: safeFinalOrder,
    historicalCurrentStock: Math.max(0, input.currentStock),
    historicalEstimatedDailyUsage,
    historicalPreInboundExpectedConsumption,
    historicalCarryOver,
    historicalTargetCoverStock,
    usedForTarget: false,
    excludedReason,
  };
}

function selectTargetCandidates(
  candidates: RecommendationTargetCandidate[],
  vendor: 'farmers' | 'marketbom',
  orderDay: number,
  appliedCoverDays: string[]
): {
  candidates: RecommendationTargetCandidate[];
  learnedTargetCoverStock: number;
  averageTargetCoverStock: number;
  fallbackLevel: number;
  fallbackLabel: string;
  confidence: string;
} {
  const valid = candidates.filter(candidate => !candidate.excludedReason && candidate.historicalTargetCoverStock > 0);
  const sameOrderDay = valid.filter(candidate => candidate.orderDay === orderDay);
  const samePattern = sameOrderDay.filter(candidate => sameCoverPattern(candidate.coverDays, appliedCoverDays));
  const sameCount = sameOrderDay.filter(candidate => candidate.coverDaysCount === appliedCoverDays.length);

  const fallbackOptions = [
    { level: 1, label: '같은 업체/품목/발주요일/커버일 패턴', confidence: '신뢰도 높음', candidates: samePattern },
    { level: 2, label: '같은 업체/품목/발주요일/커버일수', confidence: '신뢰도 보통', candidates: sameCount },
    { level: 3, label: '같은 업체/품목 최근 정상 기록 전체', confidence: '신뢰도 낮음', candidates: valid },
  ];

  const selected = fallbackOptions.find(option => option.candidates.length > 0);
  if (!selected) {
    return {
      candidates: [],
      learnedTargetCoverStock: 0,
      averageTargetCoverStock: 0,
      fallbackLevel: 4,
      fallbackLabel: `${vendor === 'farmers' ? '파머스' : '마켓봄'} 기존 estimatedDailyUsage 기반 fallback`,
      confidence: '임시 추천',
    };
  }

  const values = selected.candidates.map(candidate => candidate.historicalTargetCoverStock);
  return {
    candidates: selected.candidates,
    learnedTargetCoverStock: median(values),
    averageTargetCoverStock: avg(values),
    fallbackLevel: selected.level,
    fallbackLabel: selected.label,
    confidence: selected.confidence,
  };
}

function parseCoverDays(value: string): string[] {
  return value
    .split(',')
    .map(day => day.trim())
    .filter(Boolean);
}

function sameCoverPattern(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((day, index) => day === b[index]);
}

function targetCandidateId(source: 'automation' | 'today', date: string, vendor: string, itemId: string): string {
  return `${source}__${date}__${vendor}__${itemId}`;
}

function getTargetValueExclusionReason(value: unknown, fieldName: 'finalOrder' | 'order'): string | null {
  if (value === undefined || value === null || value === '') return `${fieldName} 없음`;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '값이 0 또는 비정상';
  return null;
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
