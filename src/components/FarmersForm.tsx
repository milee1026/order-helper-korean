import React, { useMemo } from 'react';
import { ItemData } from '@/types';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { loadRecords } from '@/utils/storage';

interface FarmersFormProps {
  data: Record<string, ItemData>;
  onChange: (itemId: string, data: ItemData) => void;
}

function useBroccoliAvgPerKg(): number | null {
  return useMemo(() => {
    const records = loadRecords();
    let totalKg = 0;
    let totalCount = 0;
    for (const r of records) {
      if (r.vendor !== 'farmers') continue;
      const d = r.items.find(i => i.itemId === 'f-broccoli');
      if (!d) continue;
      const kg = Number(d.values.inboundKg) || 0;
      const count = Number(d.values.inboundCount) || 0;
      if (kg > 0 && count > 0) {
        totalKg += kg;
        totalCount += count;
      }
    }
    if (totalKg > 0 && totalCount > 0) return Math.round((totalCount / totalKg) * 10) / 10;
    return null;
  }, []);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function FarmersForm({ data, onChange }: FarmersFormProps) {
  const getItem = (id: string): ItemData => data[id] || { itemId: id, values: {}, inbound: '', order: '', memo: '' };

  const updateField = (itemId: string, key: string, val: string | number) => {
    const current = getItem(itemId);
    const updated = { ...current, values: { ...current.values, [key]: val } };
    if (key === 'inbound') updated.inbound = val;
    if (key === 'order' || key === 'orderKg' || key === 'orderBags') updated.order = val;
    onChange(itemId, updated);
  };

  const updateMemo = (itemId: string, val: string) => {
    const current = getItem(itemId);
    onChange(itemId, { ...current, memo: val });
  };

  const broccoliAvg = useBroccoliAvgPerKg();

  // ── 샐야 ──
  const sd = getItem('f-salad');
  const sdUnused = Number(sd.values.unusedPortioned) || 0;
  const sdRatio = Number(sd.values.usedRatio) || 0;
  const sdUnport = Number(sd.values.unportioned) || 0;
  const sdInbound = Number(sd.values.inbound) || 0;
  const sdTotal = sdUnused + sdRatio + sdUnport + sdInbound;
  const sdOrderKg = Number(sd.values.orderKg) || 0;
  const sdOrderRack = sdOrderKg > 0 ? sdOrderKg / 2 : null;

  // ── 브로콜리 ──
  const bd = getItem('f-broccoli');
  const bdUnused = Number(bd.values.unusedBlanched) || 0;
  const bdRatio = Number(bd.values.usedBlanchedRatio) || 0;
  const bdPrepped = Number(bd.values.prepped) || 0;
  const bdUntrimmed = Number(bd.values.untrimmed) || 0;
  const bdUntrimmedConv = bdUntrimmed / 4;
  const bdTotal = bdUnused + bdRatio + bdPrepped + bdUntrimmedConv;

  // ── 파프리카 ──
  const pd = getItem('f-paprika');
  const pdUnused = Number(pd.values.unusedPrepped) || 0;
  const pdRatio = Number(pd.values.usedRatio) || 0;
  const pdUntrimmedKg = Number(pd.values.untrimmedKg) || 0;
  const pdInboundKg = Number(pd.values.inbound) || 0;
  const pdUntrimmedConv = pdUntrimmedKg / 5 * 3;
  const pdInboundConv = pdInboundKg / 5 * 3;
  const pdTotal = pdUnused + pdRatio + pdUntrimmedConv + pdInboundConv;

  // ── 쪽파 ──
  const cd = getItem('f-chive');
  const cdUnused = Number(cd.values.unusedPortioned) || 0;
  const cdRatio = Number(cd.values.usedRatio) || 0;
  const cdUnportBags = Number(cd.values.unportionedBags) || 0;
  const cdInboundBags = Number(cd.values.inbound) || 0;
  const cdUnportConv = cdUnportBags * 2;
  const cdInboundConv = cdInboundBags * 2;
  const cdTotal = cdUnused + cdRatio + cdUnportConv + cdInboundConv;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border px-2 py-1 text-left w-28">품목</th>
            <th className="border px-2 py-1 text-left">입력 항목</th>
            <th className="border px-2 py-1 text-left w-24">자동계산</th>
            <th className="border px-2 py-1 text-left w-32">메모</th>
          </tr>
        </thead>
        <tbody>
          {/* 샐야 */}
          <tr className="hover:bg-accent/50">
            <td className="border px-2 py-1">
              <div className="font-medium">샐야</div>
              <div className="text-muted-foreground" style={{ fontSize: '10px' }}>2kg=1봉지=1락</div>
            </td>
            <td className="border px-1 py-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[
                  { key: 'unusedPortioned', label: '미사용(락)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs px-1"
                      value={sd.values[f.key] ?? ''}
                      onChange={e => updateField('f-salad', f.key, e.target.value)}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">사용중 비율</span>
                  <RatioSelector value={sdRatio} onChange={v => updateField('f-salad', 'usedRatio', v)} />
                </label>
                {[
                  { key: 'unportioned', label: '미소분(락)' },
                  { key: 'inbound', label: '입고분(락)' },
                  { key: 'orderKg', label: '발주량(kg)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs px-1"
                      value={sd.values[f.key] ?? ''}
                      onChange={e => updateField('f-salad', f.key, e.target.value)}
                    />
                  </label>
                ))}
                {sdOrderRack !== null && (
                  <span className="text-xs text-blue-600 font-medium self-center">= {sdOrderRack}락</span>
                )}
              </div>
            </td>
            <td className="border px-2 py-1 text-center font-mono text-xs">
              <div>총재고(락):</div>
              <div>{sdTotal ? round2(sdTotal) : '-'}</div>
            </td>
            <td className="border px-1 py-1">
              <Input className="h-7 text-xs px-1" placeholder="메모" value={sd.memo} onChange={e => updateMemo('f-salad', e.target.value)} />
            </td>
          </tr>

          {/* 브로콜리 */}
          <tr className="hover:bg-accent/50">
            <td className="border px-2 py-1">
              <div className="font-medium">브로콜리</div>
              <div className="text-muted-foreground" style={{ fontSize: '10px' }}>4송이 = 1/4 바트 1통</div>
              <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 4kg, 8kg 단위 발주</div>
              {broccoliAvg !== null && (
                <div className="text-blue-600" style={{ fontSize: '10px' }}>참고: 1kg ≈ {broccoliAvg}송이</div>
              )}
            </td>
            <td className="border px-1 py-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[
                  { key: 'unusedBlanched', label: '미사용 데침(1/4 바트)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs px-1"
                      value={bd.values[f.key] ?? ''}
                      onChange={e => updateField('f-broccoli', f.key, e.target.value)}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">사용 데침 비율</span>
                  <RatioSelector value={bdRatio} onChange={v => updateField('f-broccoli', 'usedBlanchedRatio', v)} />
                </label>
                {[
                  { key: 'prepped', label: '손질(1/4 바트)' },
                  { key: 'untrimmed', label: '미손질(송이)' },
                  { key: 'inboundKg', label: '입고분(kg)' },
                  { key: 'inboundCount', label: '입고분(송이)' },
                  { key: 'orderKg', label: '발주량(kg)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs px-1"
                      value={bd.values[f.key] ?? ''}
                      onChange={e => updateField('f-broccoli', f.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </td>
            <td className="border px-2 py-1 text-center font-mono text-xs">
              {bdUntrimmed > 0 && <div>미손질→{round2(bdUntrimmedConv)}</div>}
              <div>총재고(1/4 바트):</div>
              <div>{bdTotal ? round2(bdTotal) : '-'}</div>
            </td>
            <td className="border px-1 py-1">
              <Input className="h-7 text-xs px-1" placeholder="메모" value={bd.memo} onChange={e => updateMemo('f-broccoli', e.target.value)} />
            </td>
          </tr>

          {/* 파프리카 */}
          {(() => {
            return (
              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">파프리카</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>1/4 바트</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 5kg 1박스 = 1/4 바트 3개</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                      { key: 'unusedPrepped', label: '미사용 손질(1/4 바트)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={pd.values[f.key] ?? ''}
                          onChange={e => updateField('f-paprika', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용 손질 비율</span>
                      <RatioSelector value={pdRatio} onChange={v => updateField('f-paprika', 'usedRatio', v)} />
                    </label>
                    {[
                      { key: 'untrimmedKg', label: '미손질(kg)' },
                      { key: 'inbound', label: '입고분(kg)' },
                      { key: 'orderKg', label: '발주량(kg)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={pd.values[f.key] ?? ''}
                          onChange={e => updateField('f-paprika', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  {pdUntrimmedKg > 0 && <div>미손질→{round2(pdUntrimmedConv)}</div>}
                  {pdInboundKg > 0 && <div>입고→{round2(pdInboundConv)}</div>}
                  <div>총재고(1/4 바트):</div>
                  <div>{pdTotal ? round2(pdTotal) : '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={pd.memo} onChange={e => updateMemo('f-paprika', e.target.value)} />
                </td>
              </tr>
            );
          })()}

          {/* 쪽파 */}
          {(() => {
            return (
              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">쪽파</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>1/4 바트</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 1봉지(≈900g) = 1/4 바트 2개</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                      { key: 'unusedPortioned', label: '미사용 소분(1/4 바트)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={cd.values[f.key] ?? ''}
                          onChange={e => updateField('f-chive', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용 소분 비율</span>
                      <RatioSelector value={cdRatio} onChange={v => updateField('f-chive', 'usedRatio', v)} />
                    </label>
                    {[
                      { key: 'unportionedBags', label: '미소분(봉지)' },
                      { key: 'inbound', label: '입고분(봉지)' },
                      { key: 'orderBags', label: '발주량(봉지)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={cd.values[f.key] ?? ''}
                          onChange={e => updateField('f-chive', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  {cdUnportBags > 0 && <div>미소분→{round2(cdUnportConv)}</div>}
                  {cdInboundBags > 0 && <div>입고→{round2(cdInboundConv)}</div>}
                  <div>총재고(1/4 바트):</div>
                  <div>{cdTotal ? round2(cdTotal) : '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={cd.memo} onChange={e => updateMemo('f-chive', e.target.value)} />
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}
