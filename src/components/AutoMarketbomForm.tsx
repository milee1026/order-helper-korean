import React from 'react';
import { AutomationItemData, AppSettings } from '@/types';
import { MARKETBOM_CATEGORIES, getItemsByCategory, getItemById } from '@/config/items';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { computeRecommendedOrder, getStockStatus } from '@/utils/recommendations';
import { useIsMobile } from '@/hooks/use-mobile';
import { getOrderUnit, getStockUnit, fmtWithUnit } from '@/utils/itemUnits';

interface Props {
  data: Record<string, AutomationItemData>;
  onChange: (itemId: string, data: AutomationItemData) => void;
  recommendations: Record<string, { defaultOrderCandidate: number; minThresholdCandidate: number }>;
  settings: AppSettings;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function getAutoItem(data: Record<string, AutomationItemData>, id: string, rec: { defaultOrderCandidate: number; minThresholdCandidate: number } | undefined): AutomationItemData {
  return data[id] || {
    itemId: id, currentStock: 0, currentStockValues: {},
    inboundRef: 0, defaultOrderCandidate: rec?.defaultOrderCandidate || 0,
    minThresholdCandidate: rec?.minThresholdCandidate || 0,
    recommendedOrder: 0, finalOrder: 0, memo: '',
  };
}

function StatusBadge({ status }: { status: string }) {
  const color = status === '부족' ? 'text-destructive' : status === '많음' ? 'text-primary' : 'text-muted-foreground';
  return <span className={`text-xs font-medium ${color}`}>{status}</span>;
}

function computeMarketbomStock(itemId: string, values: Record<string, number | string>, settings: AppSettings): number {
  const cfg = getItemById(itemId);
  if (!cfg) return 0;

  // Meat items
  if (['m-beef', 'm-pork', 'm-chicken'].includes(itemId)) {
    const ppt = settings.meatPacksPerTray?.[itemId] || 10;
    return (Number(values.unusedTrays) || 0) * ppt + (Number(values.openPacks) || 0);
  }

  // Box sauce items
  if (['ms-salpa', 'ms-rose', 'ms-curry'].includes(itemId)) {
    return (Number(values.unusedBoxes) || 0) * 10 + (Number(values.openPacks) || 0);
  }

  // Myeongyi - no auto total
  if (itemId === 'mr-myeongyi') {
    return (Number(values.unusedQuarter) || 0) + (Number(values.quarterRatio) || 0);
  }

  // Pasta
  if (itemId === 'mo-pasta') {
    return (Number(values.unused) || 0) * 20 + (Number(values.openBags) || 0);
  }

  // Default ratio items
  return (Number(values.unused) || 0) + (Number(values.usedRatio) || 0);
}

export function AutoMarketbomForm({ data, onChange, recommendations, settings }: Props) {
  const isMobile = useIsMobile();

  const updateVal = (itemId: string, key: string, val: string | number) => {
    const rec = recommendations[itemId];
    const current = getAutoItem(data, itemId, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const newValues = { ...current.currentStockValues, [key]: sanitized };
    const stock = computeMarketbomStock(itemId, newValues, settings);
    const defOrd = rec?.defaultOrderCandidate || current.defaultOrderCandidate;
    const minThr = rec?.minThresholdCandidate || current.minThresholdCandidate;
    const recommended = computeRecommendedOrder(stock, defOrd, minThr);
    onChange(itemId, {
      ...current,
      currentStockValues: newValues,
      currentStock: stock,
      defaultOrderCandidate: defOrd,
      minThresholdCandidate: minThr,
      recommendedOrder: recommended,
      finalOrder: current.finalOrder || recommended,
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
          <CollapsibleSection key={cat} title={`${cat} (${items.length})`}>
            {isMobile ? (
              <div className="space-y-2">
                {items.map(item => {
                  const rec = recommendations[item.id];
                  const d = getAutoItem(data, item.id, rec);
                  const status = getStockStatus(d.currentStock, d.minThresholdCandidate);
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
                        {item.fields.filter(f => f.key !== 'inbound' && f.key !== 'order').map(f => (
                          f.type === 'ratio' ? (
                            <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">{f.label}</span>
                              <RatioSelector value={Number(d.currentStockValues[f.key]) || 0} onChange={v => updateVal(item.id, f.key, v)} />
                            </div>
                          ) : (
                            <label key={f.key} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">{f.label}</span>
                              <Input type="number" min="0" className="w-20 h-8 text-sm px-2" value={d.currentStockValues[f.key] ?? ''} onChange={e => updateVal(item.id, f.key, e.target.value)} />
                            </label>
                          )
                        ))}
                        <label className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">입고분 <span className="text-orange-500">(참고)</span></span>
                          <Input type="number" min="0" className="w-20 h-8 text-sm px-2" value={d.inboundRef ?? ''} onChange={e => updateInbound(item.id, e.target.value)} />
                        </label>
                        <div className="bg-muted/50 rounded p-2 space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">{item.totalLabel || '현재 재고'}</span><b>{d.currentStock ? round2(d.currentStock) : '-'}</b></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">평균발주량</span><span>{fmtWithUnit(d.defaultOrderCandidate, getOrderUnit(item.id))}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">최소재고량</span><span>{fmtWithUnit(d.minThresholdCandidate, getStockUnit(item.id))}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">추천 발주량</span><b className="text-primary">{fmtWithUnit(d.recommendedOrder, getOrderUnit(item.id))}</b></div>
                        </div>
                        <label className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium">최종 발주량({getOrderUnit(item.id)})</span>
                          <Input type="number" min="0" className="w-20 h-8 text-sm px-2 border-primary" value={d.finalOrder || ''} onChange={e => updateFinal(item.id, Number(e.target.value.replace(/-/g, '')) || 0)} />
                        </label>
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
                    const status = getStockStatus(d.currentStock, d.minThresholdCandidate);
                    return (
                      <tr key={item.id} className="hover:bg-accent/30">
                        <td className="border px-1 py-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.unitDesc}</div>
                        </td>
                        <td className="border px-1 py-1">
                          <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                            {item.fields.filter(f => f.key !== 'inbound' && f.key !== 'order').map(f => (
                              f.type === 'ratio' ? (
                                <div key={f.key} className="flex items-center gap-1">
                                  <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                                  <RatioSelector value={Number(d.currentStockValues[f.key]) || 0} onChange={v => updateVal(item.id, f.key, v)} />
                                </div>
                              ) : (
                                <label key={f.key} className="flex items-center gap-1">
                                  <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                                  <Input type="number" min="0" className="w-14 h-6 text-xs px-1" value={d.currentStockValues[f.key] ?? ''} onChange={e => updateVal(item.id, f.key, e.target.value)} />
                                </label>
                              )
                            ))}
                          </div>
                        </td>
                        <td className="border px-1 py-1 text-center">
                          <Input type="number" min="0" className="w-12 h-6 text-xs px-1 mx-auto" value={d.inboundRef ?? ''} onChange={e => updateInbound(item.id, e.target.value)} />
                        </td>
                        <td className="border px-1 py-1 text-center font-mono">
                          <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.totalLabel || '재고'}</div>
                          <b>{d.currentStock ? round2(d.currentStock) : '-'}</b>
                        </td>
                        <td className="border px-1 py-1 text-center"><StatusBadge status={status} /></td>
                        <td className="border px-1 py-1 text-center font-mono">{fmtWithUnit(d.defaultOrderCandidate, getOrderUnit(item.id))}</td>
                        <td className="border px-1 py-1 text-center font-mono">{fmtWithUnit(d.minThresholdCandidate, getStockUnit(item.id))}</td>
                        <td className="border px-1 py-1 text-center font-mono font-medium text-primary">{fmtWithUnit(d.recommendedOrder, getOrderUnit(item.id))}</td>
                        <td className="border px-1 py-1 text-center">
                          <Input type="number" min="0" className="w-14 h-6 text-xs px-1 border-primary mx-auto" value={d.finalOrder || ''} onChange={e => updateFinal(item.id, Number(e.target.value.replace(/-/g, '')) || 0)} />
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
