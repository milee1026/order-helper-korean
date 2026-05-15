import React, { useMemo } from 'react';
import { AutomationItemData, AppSettings, DailyRecord } from '@/types';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { RecommendationAuditDetails } from '@/components/RecommendationAuditDetails';
import { buildSafeCoverageRecommendationPlan, getStockStatus, type RecommendationAudit } from '@/utils/recommendations';
import { useRecords } from '@/utils/storage';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  convertStockToOrderUnits,
  formatQuantityWithUnit,
  getOrderUnit,
  getStockUnit,
  normalizeOrderQuantityWithPolicy,
} from '@/utils/itemUnits';

interface RecommendationSummary {
  defaultOrderCandidate: number;
  minThresholdCandidate: number;
  medianOrderCandidate?: number;
  trainingRecordCount?: number;
  learnedTargetCoverStock?: number;
  averageTargetCoverStock?: number;
  targetFallbackLevel?: number;
  targetFallbackLabel?: string;
  targetConfidence?: string;
}

interface Props {
  data: Record<string, AutomationItemData>;
  onChange: (itemId: string, data: AutomationItemData) => void;
  recommendations: Record<string, RecommendationSummary>;
  settings: AppSettings;
  showInbound?: boolean;
  coverDaysCount?: number;
  defaultCoverDaysCount?: number;
  leadDaysCount?: number;
  recommendationAudits?: Record<string, RecommendationAudit>;
}

type FieldType = 'number' | 'ratio';

interface StockField {
  key: string;
  label: string;
  type: FieldType;
}

interface FarmerItem {
  id: string;
  name: string;
  desc: string;
  stockFields: StockField[];
  inboundLabel: string;
  stockLabel: string;
  orderLabel: string;
  extraInbound?: { key: string; label: string };
}

const FARMER_ITEMS: FarmerItem[] = [
  {
    id: 'f-salad',
    name: '샐야',
    desc: '2kg = 1봉지 = 1락',
    stockFields: [
      { key: 'unusedPortioned', label: '미사용 소분량', type: 'number' },
      { key: 'usedRatio', label: '사용중 비율', type: 'ratio' },
      { key: 'unportioned', label: '미소분량', type: 'number' },
    ],
    inboundLabel: '입고분(락)',
    stockLabel: '현재 재고(락)',
    orderLabel: '발주량(kg)',
  },
  {
    id: 'f-broccoli',
    name: '브로콜리',
    desc: '1/4 바트 1통 = 4송이',
    stockFields: [
      { key: 'unusedBlanched', label: '미사용 데침(1/4 바트)', type: 'number' },
      { key: 'usedBlanchedRatio', label: '사용중 비율', type: 'ratio' },
      { key: 'prepped', label: '손질(1/4 바트)', type: 'number' },
      { key: 'untrimmed', label: '미손질(송이)', type: 'number' },
    ],
    inboundLabel: '입고분(kg)',
    stockLabel: '현재 재고(1/4 바트)',
    orderLabel: '발주량(kg)',
    extraInbound: { key: 'inboundCount', label: '입고분(송이)' },
  },
  {
    id: 'f-paprika',
    name: '파프리카',
    desc: '5kg = 1/4 바트 3개',
    stockFields: [
      { key: 'unusedPrepped', label: '미사용 손질(1/4 바트)', type: 'number' },
      { key: 'usedRatio', label: '사용중 비율', type: 'ratio' },
      { key: 'untrimmedKg', label: '미손질(kg)', type: 'number' },
    ],
    inboundLabel: '입고분(kg)',
    stockLabel: '현재 재고(1/4 바트)',
    orderLabel: '발주량(kg)',
  },
  {
    id: 'f-chive',
    name: '쪽파',
    desc: '1봉지 = 1/4 바트 2개',
    stockFields: [
      { key: 'unusedPortioned', label: '미사용 소분(1/4 바트)', type: 'number' },
      { key: 'usedRatio', label: '사용중 비율', type: 'ratio' },
      { key: 'unportionedBags', label: '미소분(봉지)', type: 'number' },
    ],
    inboundLabel: '입고분(봉지)',
    stockLabel: '현재 재고(1/4 바트)',
    orderLabel: '발주량(봉지)',
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function toRatioValue(value: string | number | undefined | null): number | null {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function useBroccoliAvgPerKg(records: DailyRecord[]): number | null {
  return useMemo(() => {
    let totalKg = 0;
    let totalCount = 0;

    for (const record of records) {
      if (record.vendor !== 'farmers') continue;
      const broccoli = record.items.find(item => item.itemId === 'f-broccoli');
      if (!broccoli) continue;

      const kg = Number(broccoli.values.inboundKg) || 0;
      const count = Number(broccoli.values.inboundCount) || 0;
      if (kg > 0 && count > 0) {
        totalKg += kg;
        totalCount += count;
      }
    }

    return totalKg > 0 && totalCount > 0 ? Math.round((totalCount / totalKg) * 10) / 10 : null;
  }, [records]);
}

function getAutoItem(
  data: Record<string, AutomationItemData>,
  id: string,
  rec: RecommendationSummary | undefined
): AutomationItemData {
  return data[id] || {
    itemId: id,
    currentStock: 0,
    currentStockValues: {},
    inboundRef: '',
    defaultOrderCandidate: 0,
    minThresholdCandidate: 0,
    recommendedOrder: 0,
    finalOrder: 0,
    memo: '',
  };
}

function hasItemInput(data: AutomationItemData): boolean {
  return Object.values(data.currentStockValues || {}).some(value => value !== '' && value !== null && value !== undefined)
    || data.inboundRef !== ''
    || data.finalOrder !== 0
    || data.memo !== '';
}

function StatusBadge({ status }: { status: string }) {
  const color = status === '부족' ? 'text-destructive' : status === '많음' ? 'text-primary' : 'text-muted-foreground';
  return <span className={`text-xs font-medium ${color}`}>{status}</span>;
}

function computeFarmersStock(itemId: string, values: Record<string, number | string>): number {
  switch (itemId) {
    case 'f-salad':
      return (Number(values.unusedPortioned) || 0) + (Number(values.usedRatio) || 0) + (Number(values.unportioned) || 0);
    case 'f-broccoli':
      return (Number(values.unusedBlanched) || 0)
        + (Number(values.usedBlanchedRatio) || 0)
        + (Number(values.prepped) || 0)
        + (Number(values.untrimmed) || 0) / 4;
    case 'f-paprika':
      return (Number(values.unusedPrepped) || 0)
        + (Number(values.usedRatio) || 0)
        + ((Number(values.untrimmedKg) || 0) / 5) * 3;
    case 'f-chive':
      return (Number(values.unusedPortioned) || 0) + (Number(values.usedRatio) || 0) + (Number(values.unportionedBags) || 0) * 2;
    default:
      return 0;
  }
}

export function AutoFarmersForm({
  data,
  onChange,
  recommendations,
  showInbound = true,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0,
  recommendationAudits = {},
}: Props) {
  const isMobile = useIsMobile();
  const records = useRecords();
  const broccoliAvg = useBroccoliAvgPerKg(records);

  const safeDefaultDays = Number.isFinite(defaultCoverDaysCount) && defaultCoverDaysCount > 0 ? defaultCoverDaysCount : 1;
  const safeCoverDays = Number.isFinite(coverDaysCount) && coverDaysCount > 0 ? coverDaysCount : safeDefaultDays;
  const safeLeadDays = Number.isFinite(leadDaysCount) && leadDaysCount > 0 ? leadDaysCount : 0;

  const updateVal = (id: string, key: string, val: string | number) => {
    const rec = recommendations[id];
    const current = getAutoItem(data, id, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const newValues = { ...current.currentStockValues, [key]: sanitized };
    const stock = computeFarmersStock(id, newValues);
    const defOrd = rec?.defaultOrderCandidate || current.defaultOrderCandidate;
    const minThr = rec?.minThresholdCandidate || current.minThresholdCandidate;
    const currentStockOrderUnits = convertStockToOrderUnits(id, stock);
    const plan = buildSafeCoverageRecommendationPlan(id, currentStockOrderUnits, defOrd, safeCoverDays, safeDefaultDays, safeLeadDays, {
      learnedTargetCoverStock: rec?.learnedTargetCoverStock,
      averageTargetCoverStock: rec?.averageTargetCoverStock,
      targetFallbackLevel: rec?.targetFallbackLevel,
      targetFallbackLabel: rec?.targetFallbackLabel,
      targetConfidence: rec?.targetConfidence,
    });
    const recommended = normalizeOrderQuantityWithPolicy(id, plan.recommendedRaw, {
      averageOrderCandidate: defOrd,
      medianOrderCandidate: rec?.medianOrderCandidate,
      carryOverRatio: plan.carryOverRatio,
    }).value;

    onChange(id, {
      ...current,
      currentStockValues: newValues,
      currentStock: stock,
      defaultOrderCandidate: defOrd,
      minThresholdCandidate: minThr,
      recommendedOrder: recommended,
      finalOrder: current.finalOrder,
    });
  };

  const updateFinal = (id: string, val: number) => {
    const rec = recommendations[id];
    const current = getAutoItem(data, id, rec);
    onChange(id, { ...current, finalOrder: val });
  };

  const updateMemo = (id: string, val: string) => {
    const rec = recommendations[id];
    const current = getAutoItem(data, id, rec);
    onChange(id, { ...current, memo: val });
  };

  const updateInbound = (id: string, val: string | number) => {
    const rec = recommendations[id];
    const current = getAutoItem(data, id, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    onChange(id, { ...current, inboundRef: sanitized });
  };

  const renderField = (itemId: string, field: StockField, value: string | number | undefined) => {
    if (field.type === 'ratio') {
      return (
        <div key={field.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{field.label}</span>
          <RatioSelector value={toRatioValue(value)} onChange={v => updateVal(itemId, field.key, v)} />
        </div>
      );
    }

    return (
      <label key={field.key} className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{field.label}</span>
        <Input
          type="number"
          min="0"
          className="w-20 h-8 text-sm px-2"
          value={value ?? ''}
          onChange={e => updateVal(itemId, field.key, e.target.value)}
        />
      </label>
    );
  };

  return (
    <div className="space-y-3">
      {FARMER_ITEMS.map(item => {
        const rec = recommendations[item.id];
        const d = getAutoItem(data, item.id, rec);
        const currentStockOrderUnits = convertStockToOrderUnits(item.id, d.currentStock);
        const minThresholdOrderUnits = convertStockToOrderUnits(item.id, d.minThresholdCandidate);
        const plan = buildSafeCoverageRecommendationPlan(item.id, currentStockOrderUnits, d.defaultOrderCandidate, safeCoverDays, safeDefaultDays, safeLeadDays, {
          learnedTargetCoverStock: rec?.learnedTargetCoverStock,
          averageTargetCoverStock: rec?.averageTargetCoverStock,
          targetFallbackLevel: rec?.targetFallbackLevel,
          targetFallbackLabel: rec?.targetFallbackLabel,
          targetConfidence: rec?.targetConfidence,
        });
        const status = hasItemInput(d) ? getStockStatus(currentStockOrderUnits, minThresholdOrderUnits) : '-';
        const hasInput = hasItemInput(d);
        const rounding = normalizeOrderQuantityWithPolicy(item.id, plan.recommendedRaw, {
          averageOrderCandidate: d.defaultOrderCandidate,
          medianOrderCandidate: rec?.medianOrderCandidate,
          carryOverRatio: plan.carryOverRatio,
        });
        const roundedRecommendation = rounding.value;

        return (
          <div key={item.id} className="border rounded bg-background">
            <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">{item.name}</span>
                <span className="text-muted-foreground ml-2" style={{ fontSize: '11px' }}>{item.desc}</span>
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="px-3 py-2 space-y-2">
              {item.stockFields.map(field => renderField(item.id, field, d.currentStockValues[field.key]))}

              {showInbound && (
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{item.inboundLabel}</span>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8 text-sm px-2"
                    value={d.inboundRef ?? ''}
                    onChange={e => updateInbound(item.id, e.target.value)}
                  />
                </label>
              )}

              {showInbound && item.extraInbound && item.id === 'f-broccoli' && (
                <label className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{item.extraInbound.label}</span>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8 text-sm px-2"
                    value={d.currentStockValues[item.extraInbound.key] ?? ''}
                    onChange={e => updateVal(item.id, item.extraInbound!.key, e.target.value)}
                  />
                </label>
              )}

              <div className="bg-muted/50 rounded p-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{item.stockLabel}</span>
                  <b>{hasItemInput(d) ? formatQuantityWithUnit(d.currentStock, getStockUnit(item.id)) : '-'}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">평균발주량</span>
                  <span>{hasItemInput(d) ? formatQuantityWithUnit(d.defaultOrderCandidate, getOrderUnit(item.id)) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">최소재고량</span>
                  <span>{hasItemInput(d) ? formatQuantityWithUnit(d.minThresholdCandidate, getStockUnit(item.id)) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">추천 발주량</span>
                  <b className="text-primary">
                    {hasInput
                      ? formatQuantityWithUnit(roundedRecommendation, getOrderUnit(item.id))
                      : '-'}
                  </b>
                </div>
              </div>

              <RecommendationAuditDetails
                audit={recommendationAudits[item.id]}
                currentStockConverted={currentStockOrderUnits}
                leadDays={safeLeadDays}
                plan={plan}
                roundedRecommendation={roundedRecommendation}
                roundingPolicy={rounding.policy}
                roundingReason={rounding.reason}
                orderUnit={getOrderUnit(item.id)}
                stockUnit={getStockUnit(item.id)}
                hasInput={hasInput}
              />

              {item.id === 'f-broccoli' && broccoliAvg && (
                <div className="text-xs text-blue-600">참고: 1kg ≈ {broccoliAvg}송이</div>
              )}

              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">최종 발주 ({getOrderUnit(item.id)})</span>
                <Input
                  type="number"
                  min="0"
                  className="w-20 h-8 text-sm px-2 border-primary"
                  value={d.finalOrder || ''}
                  onChange={e => updateFinal(item.id, Number(e.target.value.replace(/-/g, '')) || 0)}
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">메모</span>
                <Input
                  className="h-8 text-sm px-2 w-40"
                  value={d.memo}
                  onChange={e => updateMemo(item.id, e.target.value)}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
