import React, { useMemo } from 'react';
import { ItemConfig, ItemData } from '@/types';
import { FARMERS_ITEMS } from '@/config/items';
import { Input } from '@/components/ui/input';
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

export function FarmersForm({ data, onChange }: FarmersFormProps) {
  const getItem = (id: string): ItemData => data[id] || { itemId: id, values: {}, inbound: '', order: '', memo: '' };

  const updateField = (itemId: string, key: string, val: string | number) => {
    const current = getItem(itemId);
    const updated = { ...current, values: { ...current.values, [key]: val } };
    if (key === 'inbound') updated.inbound = val;
    if (key === 'order' || key === 'orderKg') updated.order = val;
    onChange(itemId, updated);
  };

  const updateMemo = (itemId: string, val: string) => {
    const current = getItem(itemId);
    onChange(itemId, { ...current, memo: val });
  };

  const broccoliAvg = useBroccoliAvgPerKg();

  // Compute auto values
  const saladData = getItem('f-salad');
  const saladOrderKg = Number(saladData.values.orderKg) || 0;
  const saladOrderRack = saladOrderKg > 0 ? saladOrderKg / 2 : null;
  const saladTotal = Number(saladData.values.morningStock) || 0;

  const brocData = getItem('f-broccoli');
  const brocTotal = (Number(brocData.values.blanched) || 0) + (Number(brocData.values.trimmed) || 0) + (Number(brocData.values.untrimmed) || 0) / 4;

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
              <div className="text-muted-foreground" style={{ fontSize: '10px' }}>2kg = 1락</div>
            </td>
            <td className="border px-1 py-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[
                  { key: 'morningStock', label: '아침 재고(락)' },
                  { key: 'inbound', label: '입고분(락)' },
                  { key: 'orderKg', label: '발주량(kg)' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                    <Input
                      type="number"
                      className="w-16 h-7 text-xs px-1"
                      value={saladData.values[f.key] ?? ''}
                      onChange={e => updateField('f-salad', f.key, e.target.value)}
                    />
                  </label>
                ))}
                {saladOrderRack !== null && (
                  <span className="text-xs text-blue-600 font-medium self-center">= {saladOrderRack}락</span>
                )}
              </div>
            </td>
            <td className="border px-2 py-1 text-center font-mono text-xs">
              총재고: {saladTotal || '-'}락
            </td>
            <td className="border px-1 py-1">
              <Input className="h-7 text-xs px-1" placeholder="메모" value={saladData.memo} onChange={e => updateMemo('f-salad', e.target.value)} />
            </td>
          </tr>

          {/* 브로콜리 */}
          <tr className="hover:bg-accent/50">
            <td className="border px-2 py-1">
              <div className="font-medium">브로콜리</div>
              <div className="text-muted-foreground" style={{ fontSize: '10px' }}>1/4 바트 1통 = 4송이</div>
              <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 4kg, 8kg 단위 발주</div>
              {broccoliAvg !== null && (
                <div className="text-blue-600" style={{ fontSize: '10px' }}>참고: 1kg ≈ {broccoliAvg}송이</div>
              )}
            </td>
            <td className="border px-1 py-1">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[
                  { key: 'blanched', label: '데친(1/4 바트)' },
                  { key: 'trimmed', label: '손질(1/4 바트)' },
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
                      value={brocData.values[f.key] ?? ''}
                      onChange={e => updateField('f-broccoli', f.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </td>
            <td className="border px-2 py-1 text-center font-mono text-xs">
              <div>환산: {(Number(brocData.values.untrimmed) || 0) / 4 || '-'}</div>
              <div>총가용: {brocTotal ? (Math.round(brocTotal * 100) / 100) : '-'}</div>
            </td>
            <td className="border px-1 py-1">
              <Input className="h-7 text-xs px-1" placeholder="메모" value={brocData.memo} onChange={e => updateMemo('f-broccoli', e.target.value)} />
            </td>
          </tr>

          {/* 파프리카 */}
          {(() => {
            const d = getItem('f-paprika');
            const preppedQt = Number(d.values.trimmed) || 0;
            const unpreppedKg = Number(d.values.untrimmed) || 0;
            const unpreppedConverted = unpreppedKg / 5 * 3;
            const paprikaTotal = preppedQt + unpreppedConverted;
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
                      { key: 'trimmed', label: '손질(1/4 바트)' },
                      { key: 'untrimmed', label: '미손질(kg)' },
                      { key: 'inbound', label: '입고분(kg)' },
                      { key: 'orderKg', label: '발주량(kg)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={d.values[f.key] ?? ''}
                          onChange={e => updateField('f-paprika', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  <div>총재고(1/4 바트):</div>
                  <div>{paprikaTotal || '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={d.memo} onChange={e => updateMemo('f-paprika', e.target.value)} />
                </td>
              </tr>
            );
          })()}

          {/* 쪽파 */}
          {(() => {
            const d = getItem('f-chive');
            const portionedQt = Number(d.values.portioned) || 0;
            const unportionedBags = Number(d.values.unportioned) || 0;
            const unportionedConverted = unportionedBags * 2;
            const chiveTotal = portionedQt + unportionedConverted;
            return (
              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">쪽파</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>1/4 바트</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 900g 1봉지 = 1/4 바트 2개</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                      { key: 'portioned', label: '소분(1/4 바트)' },
                      { key: 'unportioned', label: '미소분(봉지)' },
                      { key: 'inbound', label: '입고분(봉지)' },
                      { key: 'order', label: '발주량(봉지)' },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs px-1"
                          value={d.values[f.key] ?? ''}
                          onChange={e => updateField('f-chive', f.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  <div>총재고(1/4 바트):</div>
                  <div>{chiveTotal || '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={d.memo} onChange={e => updateMemo('f-chive', e.target.value)} />
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}
