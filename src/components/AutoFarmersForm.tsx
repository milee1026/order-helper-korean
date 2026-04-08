import React, { useMemo } from 'react';
import { AutomationItemData, AppSettings } from '@/types';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { computeRecommendedOrder, getStockStatus } from '@/utils/recommendations';
import { loadRecords } from '@/utils/storage';
import { useIsMobile } from '@/hooks/use-mobile';
import { getOrderUnit, getStockUnit, fmtWithUnit, normalizeOrderQuantity } from '@/utils/itemUnits';

interface Props {
  data: Record<string, AutomationItemData>;
  onChange: (itemId: string, data: AutomationItemData) => void;
  recommendations: Record<string, { defaultOrderCandidate: number; minThresholdCandidate: number }>;
  settings: AppSettings;
  showInbound?: boolean;
  autoInbound?: Record<string, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function useBroccoliAvgPerKg(): number | null {
  return useMemo(() => {
    const records = loadRecords();
    let totalKg = 0, totalCount = 0;
    for (const r of records) {
      if (r.vendor !== 'farmers') continue;
      const d = r.items.find(i => i.itemId === 'f-broccoli');
      if (!d) continue;
      const kg = Number(d.values.inboundKg) || 0;
      const count = Number(d.values.inboundCount) || 0;
      if (kg > 0 && count > 0) { totalKg += kg; totalCount += count; }
    }
    return totalKg > 0 && totalCount > 0 ? Math.round((totalCount / totalKg) * 10) / 10 : null;
  }, []);
}

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

export function AutoFarmersForm({ data, onChange, recommendations }: Props) {
  const isMobile = useIsMobile();
  const broccoliAvg = useBroccoliAvgPerKg();

  const updateVal = (id: string, key: string, val: string | number) => {
    const rec = recommendations[id];
    const current = getAutoItem(data, id, rec);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const newValues = { ...current.currentStockValues, [key]: sanitized };
    const stock = computeFarmersStock(id, newValues);
    const defOrd = rec?.defaultOrderCandidate || current.defaultOrderCandidate;
    const minThr = rec?.minThresholdCandidate || current.minThresholdCandidate;
    const rawRecommended = computeRecommendedOrder(stock, defOrd, minThr);
    const recommended = normalizeOrderQuantity(id, rawRecommended);
    onChange(id, {
      ...current,
      currentStockValues: newValues,
      currentStock: stock,
      defaultOrderCandidate: defOrd,
      minThresholdCandidate: minThr,
      recommendedOrder: recommended,
      finalOrder: current.finalOrder || recommended,
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

  const items = [
    {
      id: 'f-salad', name: '샐야', desc: '2kg = 1봉지 = 1락', orderUnit: 'kg',
      stockFields: [
        { key: 'unusedPortioned', label: '미사용 소분량(락)', type: 'number' },
        { key: 'usedRatio', label: '사용중 비율', type: 'ratio' },
        { key: 'unportioned', label: '미소분량(락)', type: 'number' },
      ],
      inboundLabel: '입고분(락)',
      stockLabel: '현재 재고(락)',
      orderLabel: '발주량(kg)',
    },
    {
      id: 'f-broccoli', name: '브로콜리', desc: '1/4 바트 1통 = 4송이', orderUnit: 'kg',
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
      id: 'f-paprika', name: '파프리카', desc: '5kg = 1/4 바트 3개', orderUnit: 'kg',
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
      id: 'f-chive', name: '쪽파', desc: '1봉지 = 1/4 바트 2개', orderUnit: '봉지',
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

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map(item => {
          const rec = recommendations[item.id];
          const d = getAutoItem(data, item.id, rec);
          const status = getStockStatus(d.currentStock, d.minThresholdCandidate);
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
                {item.stockFields.map(f => (
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
                  <span className="text-muted-foreground">{item.inboundLabel} <span className="text-orange-500">(참고)</span></span>
                  <Input type="number" min="0" className="w-20 h-8 text-sm px-2" value={d.inboundRef ?? ''} onChange={e => updateInbound(item.id, e.target.value)} />
                </label>
                {item.id === 'f-broccoli' && item.extraInbound && (
                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{item.extraInbound.label} <span className="text-orange-500">(참고)</span></span>
                    <Input type="number" min="0" className="w-20 h-8 text-sm px-2" value={d.currentStockValues.inboundCount ?? ''} onChange={e => updateVal(item.id, 'inboundCount', e.target.value)} />
                  </label>
                )}
                <div className="bg-muted/50 rounded p-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{item.stockLabel}</span><b>{d.currentStock ? round2(d.currentStock) : '-'}</b></div>
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
                {item.id === 'f-broccoli' && broccoliAvg && (
                  <div className="text-xs text-blue-600">참고: 1kg ≈ {broccoliAvg}송이</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop table
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border px-2 py-1 text-left w-24">품목</th>
            <th className="border px-2 py-1 text-left">재고 입력</th>
            <th className="border px-1 py-1 w-12">입고(참고)</th>
            <th className="border px-1 py-1 w-14">현재재고</th>
            <th className="border px-1 py-1 w-10">상태</th>
            <th className="border px-1 py-1 w-12">평균발주량</th>
            <th className="border px-1 py-1 w-12">최소재고량</th>
            <th className="border px-1 py-1 w-14">추천발주량</th>
            <th className="border px-1 py-1 w-16">최종발주</th>
            <th className="border px-1 py-1 w-20">메모</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const rec = recommendations[item.id];
            const d = getAutoItem(data, item.id, rec);
            const status = getStockStatus(d.currentStock, d.minThresholdCandidate);
            return (
              <tr key={item.id} className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.desc}</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                    {item.stockFields.map(f => (
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
                  <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.stockLabel}</div>
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
    </div>
  );
}

function computeFarmersStock(itemId: string, values: Record<string, number | string>): number {
  switch (itemId) {
    case 'f-salad':
      return (Number(values.unusedPortioned) || 0) + (Number(values.usedRatio) || 0) + (Number(values.unportioned) || 0);
    case 'f-broccoli':
      return (Number(values.unusedBlanched) || 0) + (Number(values.usedBlanchedRatio) || 0) + (Number(values.prepped) || 0) + (Number(values.untrimmed) || 0) / 4;
    case 'f-paprika':
      return (Number(values.unusedPrepped) || 0) + (Number(values.usedRatio) || 0) + (Number(values.untrimmedKg) || 0) / 5 * 3;
    case 'f-chive':
      return (Number(values.unusedPortioned) || 0) + (Number(values.usedRatio) || 0) + (Number(values.unportionedBags) || 0) * 2;
    default:
      return 0;
  }
}
