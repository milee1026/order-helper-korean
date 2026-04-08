import React, { useMemo } from 'react';
import { ItemData } from '@/types';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { loadRecords } from '@/utils/storage';
import { useIsMobile } from '@/hooks/use-mobile';

interface FarmersFormProps {
  data: Record<string, ItemData>;
  onChange: (itemId: string, data: ItemData) => void;
  showInbound?: boolean;
  autoInbound?: Record<string, number>;
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

export function FarmersForm({ data, onChange, showInbound = true, autoInbound = {} }: FarmersFormProps) {
  const getItem = (id: string): ItemData => data[id] || { itemId: id, values: {}, inbound: '', order: '', memo: '' };
  const isMobile = useIsMobile();

  const updateField = (itemId: string, key: string, val: string | number) => {
    const current = getItem(itemId);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const updated = { ...current, values: { ...current.values, [key]: sanitized } };
    if (key === 'inbound') updated.inbound = sanitized;
    if (key === 'order' || key === 'orderKg' || key === 'orderBags') updated.order = sanitized;
    onChange(itemId, updated);
  };

  const updateMemo = (itemId: string, val: string) => {
    const current = getItem(itemId);
    onChange(itemId, { ...current, memo: val });
  };

  const broccoliAvg = useBroccoliAvgPerKg();

  const sd = getItem('f-salad');
  const sdUnused = Number(sd.values.unusedPortioned) || 0;
  const sdRatio = Number(sd.values.usedRatio) || 0;
  const sdUnport = Number(sd.values.unportioned) || 0;
  const sdTotal = sdUnused + sdRatio + sdUnport;
  const sdOrderKg = Number(sd.values.orderKg) || 0;
  const sdOrderRack = sdOrderKg > 0 ? sdOrderKg / 2 : null;
  const sdInboundValue = sd.values.inbound ?? (showInbound ? (autoInbound['f-salad'] ?? '') : '');

  const bd = getItem('f-broccoli');
  const bdUnused = Number(bd.values.unusedBlanched) || 0;
  const bdRatio = Number(bd.values.usedBlanchedRatio) || 0;
  const bdPrepped = Number(bd.values.prepped) || 0;
  const bdUntrimmed = Number(bd.values.untrimmed) || 0;
  const bdUntrimmedConv = bdUntrimmed / 4;
  const bdTotal = bdUnused + bdRatio + bdPrepped + bdUntrimmedConv;
  const bdInboundKgValue = bd.values.inboundKg ?? (showInbound ? (autoInbound['f-broccoli'] ?? '') : '');

  const pd = getItem('f-paprika');
  const pdUnused = Number(pd.values.unusedPrepped) || 0;
  const pdRatio = Number(pd.values.usedRatio) || 0;
  const pdUntrimmedKg = Number(pd.values.untrimmedKg) || 0;
  const pdUntrimmedConv = (pdUntrimmedKg / 5) * 3;
  const pdTotal = pdUnused + pdRatio + pdUntrimmedConv;
  const pdInboundValue = pd.values.inbound ?? (showInbound ? (autoInbound['f-paprika'] ?? '') : '');

  const cd = getItem('f-chive');
  const cdUnused = Number(cd.values.unusedPortioned) || 0;
  const cdRatio = Number(cd.values.usedRatio) || 0;
  const cdUnportBags = Number(cd.values.unportionedBags) || 0;
  const cdUnportConv = cdUnportBags * 2;
  const cdTotal = cdUnused + cdRatio + cdUnportConv;
  const cdInboundValue = cd.values.inbound ?? (showInbound ? (autoInbound['f-chive'] ?? '') : '');

  return (
    <div>
      {isMobile ? (
        <div className="space-y-3">
          <MobileCard
            name="샐야"
            desc="2kg = 1봉지 = 1락"
            note="참고: 2kg 단위 발주"
            total={<>총재고(락): <b>{sdTotal ? round2(sdTotal) : '-'}</b></>}
            memo={sd.memo}
            onMemoChange={v => updateMemo('f-salad', v)}
          >
            <MobileNumField label="미사용(락)" value={sd.values.unusedPortioned} onChange={v => updateField('f-salad', 'unusedPortioned', v)} />
            <MobileRatioField label="사용중 비율" value={sdRatio} onChange={v => updateField('f-salad', 'usedRatio', v)} />
            <MobileNumField label="미소분(락)" value={sd.values.unportioned} onChange={v => updateField('f-salad', 'unportioned', v)} />
            {showInbound && <MobileNumField label="입고분(락)" value={sdInboundValue} onChange={v => updateField('f-salad', 'inbound', v)} />}
            <MobileNumField label="발주량(kg)" value={sd.values.orderKg} onChange={v => updateField('f-salad', 'orderKg', v)} />
            {sdOrderRack !== null && <div className="text-xs text-primary font-medium">= {sdOrderRack}락</div>}
          </MobileCard>

          <MobileCard
            name="브로콜리"
            desc="4송이 = 1/4 바트 1통"
            note="참고: 4kg, 8kg 단위 발주"
            extraNote={broccoliAvg !== null ? `참고: 1kg ≈ ${broccoliAvg}송이` : undefined}
            total={<>{bdUntrimmed > 0 && <span>미손질→{round2(bdUntrimmedConv)} </span>}총재고(1/4 바트): <b>{bdTotal ? round2(bdTotal) : '-'}</b></>}
            memo={bd.memo}
            onMemoChange={v => updateMemo('f-broccoli', v)}
          >
            <MobileNumField label="미사용 데침(1/4 바트)" value={bd.values.unusedBlanched} onChange={v => updateField('f-broccoli', 'unusedBlanched', v)} />
            <MobileRatioField label="사용중 비율" value={bdRatio} onChange={v => updateField('f-broccoli', 'usedBlanchedRatio', v)} />
            <MobileNumField label="손질(1/4 바트)" value={bd.values.prepped} onChange={v => updateField('f-broccoli', 'prepped', v)} />
            <MobileNumField label="미손질(송이)" value={bd.values.untrimmed} onChange={v => updateField('f-broccoli', 'untrimmed', v)} />
            {showInbound && <MobileNumField label="입고분(kg)" value={bdInboundKgValue} onChange={v => updateField('f-broccoli', 'inboundKg', v)} />}
            {showInbound && <MobileNumField label="입고분(송이)" value={bd.values.inboundCount} onChange={v => updateField('f-broccoli', 'inboundCount', v)} />}
            <MobileNumField label="발주량(kg)" value={bd.values.orderKg} onChange={v => updateField('f-broccoli', 'orderKg', v)} />
          </MobileCard>

          <MobileCard
            name="파프리카"
            desc="5kg = 1/4 바트 3통"
            note="참고: 5kg 단위 발주"
            total={<>{pdUntrimmedKg > 0 && <span>미손질→{round2(pdUntrimmedConv)} </span>}총재고(1/4 바트): <b>{pdTotal ? round2(pdTotal) : '-'}</b></>}
            memo={pd.memo}
            onMemoChange={v => updateMemo('f-paprika', v)}
          >
            <MobileNumField label="미사용 손질(1/4 바트)" value={pd.values.unusedPrepped} onChange={v => updateField('f-paprika', 'unusedPrepped', v)} />
            <MobileRatioField label="사용중 비율" value={pdRatio} onChange={v => updateField('f-paprika', 'usedRatio', v)} />
            <MobileNumField label="미손질(kg)" value={pd.values.untrimmedKg} onChange={v => updateField('f-paprika', 'untrimmedKg', v)} />
            {showInbound && <MobileNumField label="입고분(kg)" value={pdInboundValue} onChange={v => updateField('f-paprika', 'inbound', v)} />}
            <MobileNumField label="발주량(kg)" value={pd.values.orderKg} onChange={v => updateField('f-paprika', 'orderKg', v)} />
          </MobileCard>

          <MobileCard
            name="쪽파"
            desc="1봉지(900g) = 1/4 바트 2통"
            note="참고: 1봉지(900g) 단위 발주"
            total={<>{cdUnportBags > 0 && <span>미소분→{round2(cdUnportConv)} </span>}총재고(1/4 바트): <b>{cdTotal ? round2(cdTotal) : '-'}</b></>}
            memo={cd.memo}
            onMemoChange={v => updateMemo('f-chive', v)}
          >
            <MobileNumField label="미사용 소분(1/4 바트)" value={cd.values.unusedPortioned} onChange={v => updateField('f-chive', 'unusedPortioned', v)} />
            <MobileRatioField label="사용중 비율" value={cdRatio} onChange={v => updateField('f-chive', 'usedRatio', v)} />
            <MobileNumField label="미소분(봉지)" value={cd.values.unportionedBags} onChange={v => updateField('f-chive', 'unportionedBags', v)} />
            {showInbound && <MobileNumField label="입고분(봉지)" value={cdInboundValue} onChange={v => updateField('f-chive', 'inbound', v)} />}
            <MobileNumField label="발주량(봉지)" value={cd.values.orderBags} onChange={v => updateField('f-chive', 'orderBags', v)} />
          </MobileCard>
        </div>
      ) : (
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
              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">샐야</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>2kg = 1봉지 = 1락</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 2kg 단위 발주</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미사용(락)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={sd.values.unusedPortioned ?? ''} onChange={e => updateField('f-salad', 'unusedPortioned', e.target.value)} />
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용중 비율</span>
                      <RatioSelector value={sdRatio} onChange={v => updateField('f-salad', 'usedRatio', v)} />
                    </div>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미소분(락)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={sd.values.unportioned ?? ''} onChange={e => updateField('f-salad', 'unportioned', e.target.value)} />
                    </label>
                    {showInbound && (
                      <label className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">입고분(락)</span>
                        <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={sdInboundValue} onChange={e => updateField('f-salad', 'inbound', e.target.value)} />
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">발주량(kg)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={sd.values.orderKg ?? ''} onChange={e => updateField('f-salad', 'orderKg', e.target.value)} />
                    </label>
                    {sdOrderRack !== null && <span className="text-xs text-primary font-medium self-center">= {sdOrderRack}락</span>}
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

              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">브로콜리</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>4송이 = 1/4 바트 1통</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 4kg, 8kg 단위 발주</div>
                  {broccoliAvg !== null && <div className="text-blue-600" style={{ fontSize: '10px' }}>참고: 1kg ≈ {broccoliAvg}송이</div>}
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미사용 데침(1/4 바트)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bd.values.unusedBlanched ?? ''} onChange={e => updateField('f-broccoli', 'unusedBlanched', e.target.value)} />
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용중 비율</span>
                      <RatioSelector value={bdRatio} onChange={v => updateField('f-broccoli', 'usedBlanchedRatio', v)} />
                    </div>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">손질(1/4 바트)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bd.values.prepped ?? ''} onChange={e => updateField('f-broccoli', 'prepped', e.target.value)} />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미손질(송이)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bd.values.untrimmed ?? ''} onChange={e => updateField('f-broccoli', 'untrimmed', e.target.value)} />
                    </label>
                    {showInbound && (
                      <>
                        <label className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">입고분(kg)</span>
                          <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bdInboundKgValue} onChange={e => updateField('f-broccoli', 'inboundKg', e.target.value)} />
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground whitespace-nowrap">입고분(송이)</span>
                          <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bd.values.inboundCount ?? ''} onChange={e => updateField('f-broccoli', 'inboundCount', e.target.value)} />
                        </label>
                      </>
                    )}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">발주량(kg)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={bd.values.orderKg ?? ''} onChange={e => updateField('f-broccoli', 'orderKg', e.target.value)} />
                    </label>
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

              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">파프리카</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>5kg = 1/4 바트 3통</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 5kg 단위 발주</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미사용 손질(1/4 바트)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={pd.values.unusedPrepped ?? ''} onChange={e => updateField('f-paprika', 'unusedPrepped', e.target.value)} />
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용중 비율</span>
                      <RatioSelector value={pdRatio} onChange={v => updateField('f-paprika', 'usedRatio', v)} />
                    </div>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미손질(kg)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={pd.values.untrimmedKg ?? ''} onChange={e => updateField('f-paprika', 'untrimmedKg', e.target.value)} />
                    </label>
                    {showInbound && (
                      <label className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">입고분(kg)</span>
                        <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={pdInboundValue} onChange={e => updateField('f-paprika', 'inbound', e.target.value)} />
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">발주량(kg)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={pd.values.orderKg ?? ''} onChange={e => updateField('f-paprika', 'orderKg', e.target.value)} />
                    </label>
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  {pdUntrimmedKg > 0 && <div>미손질→{round2(pdUntrimmedConv)}</div>}
                  <div>총재고(1/4 바트):</div>
                  <div>{pdTotal ? round2(pdTotal) : '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={pd.memo} onChange={e => updateMemo('f-paprika', e.target.value)} />
                </td>
              </tr>

              <tr className="hover:bg-accent/50">
                <td className="border px-2 py-1">
                  <div className="font-medium">쪽파</div>
                  <div className="text-muted-foreground" style={{ fontSize: '10px' }}>1봉지(900g) = 1/4 바트 2통</div>
                  <div className="text-orange-600" style={{ fontSize: '10px' }}>참고: 1봉지(900g) 단위 발주</div>
                </td>
                <td className="border px-1 py-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미사용 소분(1/4 바트)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={cd.values.unusedPortioned ?? ''} onChange={e => updateField('f-chive', 'unusedPortioned', e.target.value)} />
                    </label>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">사용중 비율</span>
                      <RatioSelector value={cdRatio} onChange={v => updateField('f-chive', 'usedRatio', v)} />
                    </div>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">미소분(봉지)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={cd.values.unportionedBags ?? ''} onChange={e => updateField('f-chive', 'unportionedBags', e.target.value)} />
                    </label>
                    {showInbound && (
                      <label className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">입고분(봉지)</span>
                        <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={cdInboundValue} onChange={e => updateField('f-chive', 'inbound', e.target.value)} />
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground whitespace-nowrap">발주량(봉지)</span>
                      <Input type="number" min="0" className="w-16 h-7 text-xs px-1" value={cd.values.orderBags ?? ''} onChange={e => updateField('f-chive', 'orderBags', e.target.value)} />
                    </label>
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  {cdUnportBags > 0 && <div>미소분→{round2(cdUnportConv)}</div>}
                  <div>총재고(1/4 바트):</div>
                  <div>{cdTotal ? round2(cdTotal) : '-'}</div>
                </td>
                <td className="border px-1 py-1">
                  <Input className="h-7 text-xs px-1" placeholder="메모" value={cd.memo} onChange={e => updateMemo('f-chive', e.target.value)} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MobileCard({ name, desc, note, extraNote, total, memo, onMemoChange, children }: {
  name: string; desc: string; note: string; extraNote?: string;
  total: React.ReactNode; memo: string; onMemoChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded bg-background">
      <div className="px-3 py-2 bg-muted/50 border-b">
        <div className="font-medium text-sm">{name}</div>
        <div className="text-muted-foreground" style={{ fontSize: '11px' }}>{desc}</div>
        <div className="text-orange-600" style={{ fontSize: '11px' }}>{note}</div>
        {extraNote && <div className="text-blue-600" style={{ fontSize: '11px' }}>{extraNote}</div>}
      </div>
      <div className="px-3 py-2 space-y-2">{children}</div>
      <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between gap-2">
        <div className="text-xs font-mono">{total}</div>
        <Input className="h-7 text-xs px-1 w-28" placeholder="메모" value={memo} onChange={e => onMemoChange(e.target.value)} />
      </div>
    </div>
  );
}

function MobileNumField({ label, value, onChange }: { label: string; value: string | number | undefined; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" min="0" className="w-20 h-8 text-sm px-2" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function MobileRatioField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <RatioSelector value={value} onChange={onChange} />
    </div>
  );
}
