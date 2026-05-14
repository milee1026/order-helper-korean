import React from 'react';
import { AutomationItemData, AppSettings } from '@/types';
import { MARKETBOM_CATEGORIES, getItemsByCategory } from '@/config/items';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { buildCoverageRecommendationPlan, getStockStatus } from '@/utils/recommendations';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  convertStockToOrderUnits,
  formatQuantityWithUnit,
  getOrderUnit,
  getStockUnit,
  normalizeOrderQuantity,
} from '@/utils/itemUnits';

interface Props {
  data: Record<string, AutomationItemData>;
  onChange: (itemId: string, data: AutomationItemData) => void;
  recommendations: Record<string, { defaultOrderCandidate: number; minThresholdCandidate: number }>;
  settings: AppSettings;
  showInbound?: boolean;
  coverDaysCount?: number;
  defaultCoverDaysCount?: number;
  leadDaysCount?: number;
}

function toRatioValue(value: string | number | undefined | null): number | null {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function getAutoItem(
  data: Record<string, AutomationItemData>,
  id: string,
  rec: { defaultOrderCandidate: number; minThresholdCandidate: number } | undefined
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

function computeMarketbomStock(itemId: string, values: Record<string, number | string>, settings: AppSettings): number {
  if (['m-beef', 'm-pork', 'm-chicken'].includes(itemId)) {
    const ppt = itemId === 'm-beef' ? 5 : itemId === 'm-pork' ? 4 : 5;
    return (Number(values.unusedTrays) || 0) * ppt + (Number(values.openPacks) || 0);
  }

  if (['ms-salpa', 'ms-rose', 'ms-curry'].includes(itemId)) {
    return (Number(values.unusedBoxes) || 0) * 10 + (Number(values.openPacks) || 0);
  }

  if (itemId === 'mr-myeongyi') {
    return (Number(values.unusedQuarter) || 0) + (Number(values.quarterRatio) || 0);
  }

  if (itemId === 'mo-pasta') {
    return (Number(values.unused) || 0) * 20 + (Number(values.openBags) || 0);
  }

  return (Number(values.unused) || 0) + (Number(values.usedRatio) || 0);
}

function renderStockInput(
  itemId: string,
  field: { key: string; label: string; type: string },
  value: string | number | undefined,
  onChange: (val: string | number) => void
) {
  if (field.type === 'ratio') {
    return (
      <div key={field.key} className="flex items-center gap-1">
        <span className="text-muted-foreground whitespace-nowrap">{field.label}</span>
        <RatioSelector value={toRatioValue(value)} onChange={onChange} />
      </div>
    );
  }

  return (
    <label key={field.key} className="flex items-center gap-1">
      <span className="text-muted-foreground whitespace-nowrap">{field.label}</span>
      <Input
        type={field.type === 'text' ? 'text' : 'number'}
        min={field.type === 'number' ? '0' : undefined}
        className="w-14 h-6 text-xs px-1"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  );
}

export function AutoMarketbomForm({
  data,
  onChange,
  recommendations,
  settings,
  showInbound = true,
  coverDaysCount = 0,
  defaultCoverDaysCount = 0,
  leadDaysCount = 0,
}: Props) {
  const isMobile = useIsMobile();

  const safeDefaultDays = Number.isFinite(defaultCoverDaysCount) && defaultCoverDaysCount > 0 ? defaultCoverDaysCount : 1;
  const safeCoverDays = Number.isFinite(coverDaysCount) && coverDaysCount > 0 ? coverDaysCount : safeDefaultDays;
  const safeLeadDays = Number.isFinite(leadDaysCount) && leadDaysCount > 0 ? leadDaysCount : 0;

  const updateVal = (itemId: string, key: string, val: string | number) => {
    const rec = recommendations[itemId];
    const current = getAutoItem(data, itemId, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const newValues = { ...current.currentStockValues, [key]: sanitized };
    const stock = computeMarketbomStock(itemId, newValues, settings);
    const defOrd = rec?.defaultOrderCandidate || current.defaultOrderCandidate;
    const minThr = rec?.minThresholdCandidate || current.minThresholdCandidate;
    const currentStockOrderUnits = convertStockToOrderUnits(itemId, stock, settings);
    const plan = buildCoverageRecommendationPlan(currentStockOrderUnits, defOrd, safeCoverDays, safeDefaultDays, safeLeadDays);
    const recommended = normalizeOrderQuantity(itemId, plan.recommendedRaw);

    onChange(itemId, {
      ...current,
      currentStockValues: newValues,
      currentStock: stock,
      defaultOrderCandidate: defOrd,
      minThresholdCandidate: minThr,
      recommendedOrder: recommended,
      finalOrder: current.finalOrder,
    });
  };

  const updateFinal = (itemId: string, val: number) => {
    const rec = recommendations[itemId];
    const current = getAutoItem(data, itemId, rec);
    onChange(itemId, { ...current, finalOrder: val });
  };

  const updateMemo = (itemId: string, val: string) => {
    const rec = recommendations[itemId];
    const current = getAutoItem(data, itemId, rec);
    onChange(itemId, { ...current, memo: val });
  };

  const updateInbound = (itemId: string, val: string | number) => {
    const rec = recommendations[itemId];
    const current = getAutoItem(data, itemId, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    onChange(itemId, { ...current, inboundRef: sanitized });
  };

  return (
    <div>
      {MARKETBOM_CATEGORIES.map(cat => {
        const items = getItemsByCategory(cat);
        return (
          <CollapsibleSection
            key={cat}
            title={`${cat} (${items.length})`}
          >
            {isMobile ? (
              <div className="space-y-2">
                {items.map(item => {
                  const rec = recommendations[item.id];
                  const d = getAutoItem(data, item.id, rec);
                  const currentStockOrderUnits = convertStockToOrderUnits(item.id, d.currentStock, settings);
                  const minThresholdOrderUnits = convertStockToOrderUnits(item.id, d.minThresholdCandidate, settings);
                  const plan = buildCoverageRecommendationPlan(currentStockOrderUnits, d.defaultOrderCandidate, safeCoverDays, safeDefaultDays, safeLeadDays);
                  const status = hasItemInput(d) ? getStockStatus(currentStockOrderUnits, minThresholdOrderUnits) : '-';

                  return (
                    <div key={item.id} className="border rounded bg-background">
                      <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm">{item.name}</span>
                          <span className="text-muted-foreground ml-2" style={{ fontSize: '11px' }}>{item.unitDesc}</span>
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      <div className="px-3 py-2 space-y-2">
                        {item.fields
                          .filter(f => f.key !== 'inbound' && f.key !== 'order')
                          .map(f => renderStockInput(
                            item.id,
                            f,
                            d.currentStockValues[f.key],
                            val => updateVal(item.id, f.key, val)
                          ))}

                        {showInbound && (
                          <label className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">입고(참고)</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <Input
                                type="number"
                                min="0"
                                className="w-20 h-8 text-sm px-2"
                                value={d.inboundRef ?? ''}
                                onChange={e => updateInbound(item.id, e.target.value)}
                              />
                              <span className="text-muted-foreground" style={{ fontSize: '9px' }}>{getStockUnit(item.id)}</span>
                            </div>
                          </label>
                        )}

                        <div className="bg-muted/50 rounded p-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{item.totalLabel || '현재재고'}</span>
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
                              {hasItemInput(d)
                                ? formatQuantityWithUnit(normalizeOrderQuantity(item.id, plan.recommendedRaw), getOrderUnit(item.id))
                                : '-'}
                            </b>
                          </div>
                        </div>

                        <label className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">메모</span>
                          <Input className="h-8 text-sm px-2 w-40" value={d.memo} onChange={e => updateMemo(item.id, e.target.value)} />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-1 py-1 text-left w-24">품목</th>
                    <th className="border px-1 py-1 text-left">재고 입력</th>
                    <th className="border px-1 py-1 w-12">입고(참고)</th>
                    <th className="border px-1 py-1 w-14">현재재고</th>
                    <th className="border px-1 py-1 w-8">상태</th>
                    <th className="border px-1 py-1 w-12">평균발주량</th>
                    <th className="border px-1 py-1 w-12">최소재고량</th>
                    <th className="border px-1 py-1 w-12">추천발주량</th>
                    <th className="border px-1 py-1 w-14">최종발주</th>
                    <th className="border px-1 py-1 w-20">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const rec = recommendations[item.id];
                    const d = getAutoItem(data, item.id, rec);
                    const currentStockOrderUnits = convertStockToOrderUnits(item.id, d.currentStock, settings);
                    const minThresholdOrderUnits = convertStockToOrderUnits(item.id, d.minThresholdCandidate, settings);
                    const plan = buildCoverageRecommendationPlan(currentStockOrderUnits, d.defaultOrderCandidate, safeCoverDays, safeDefaultDays, safeLeadDays);
                    const status = hasItemInput(d) ? getStockStatus(currentStockOrderUnits, minThresholdOrderUnits) : '-';

                    return (
                      <tr key={item.id} className="hover:bg-accent/30">
                        <td className="border px-1 py-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.unitDesc}</div>
                        </td>
                        <td className="border px-1 py-1">
                          <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                            {item.fields
                              .filter(f => f.key !== 'inbound' && f.key !== 'order')
                              .map(f => renderStockInput(
                                item.id,
                                f,
                                d.currentStockValues[f.key],
                                val => updateVal(item.id, f.key, val)
                              ))}
                          </div>
                        </td>
                        <td className="border px-1 py-1 text-center">
                          {showInbound ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <Input
                                type="number"
                                min="0"
                                className="w-12 h-6 text-xs px-1 mx-auto"
                                value={d.inboundRef ?? ''}
                                onChange={e => updateInbound(item.id, e.target.value)}
                              />
                              <span className="text-muted-foreground" style={{ fontSize: '9px' }}>{getStockUnit(item.id)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className="border px-1 py-1 text-center font-mono">
                          <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.totalLabel || '현재재고'}</div>
                          <b>{hasItemInput(d) ? formatQuantityWithUnit(d.currentStock, getStockUnit(item.id)) : '-'}</b>
                        </td>
                        <td className="border px-1 py-1 text-center"><StatusBadge status={status} /></td>
                        <td className="border px-1 py-1 text-center font-mono">
                          {hasItemInput(d) ? formatQuantityWithUnit(d.defaultOrderCandidate, getOrderUnit(item.id)) : '-'}
                        </td>
                        <td className="border px-1 py-1 text-center font-mono">
                          {hasItemInput(d) ? formatQuantityWithUnit(d.minThresholdCandidate, getStockUnit(item.id)) : '-'}
                        </td>
                        <td className="border px-1 py-1 text-center font-mono font-medium text-primary">
                          {hasItemInput(d)
                            ? formatQuantityWithUnit(normalizeOrderQuantity(item.id, plan.recommendedRaw), getOrderUnit(item.id))
                            : '-'}
                        </td>
                        <td className="border px-1 py-1 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <Input
                              type="number"
                              min="0"
                              className="w-14 h-6 text-xs px-1 border-primary mx-auto"
                              value={d.finalOrder || ''}
                              onChange={e => updateFinal(item.id, Number(e.target.value.replace(/-/g, '')) || 0)}
                            />
                            <span className="text-muted-foreground" style={{ fontSize: '9px' }}>{getOrderUnit(item.id)}</span>
                          </div>
                        </td>
                        <td className="border px-1 py-1">
                          <Input className="h-6 text-xs px-1" value={d.memo} onChange={e => updateMemo(item.id, e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CollapsibleSection>
        );
      })}
    </div>
  );
}
