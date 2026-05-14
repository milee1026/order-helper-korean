import React, { useMemo, useState } from 'react';
import { useRecords, deleteRecord } from '@/utils/storage';
import { getItemById } from '@/config/items';
import { DAY_NAMES_KR } from '@/config/ordering';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { readCompatibleInbound } from '@/utils/recordCompatibility';

export function RecordHistory() {
  const { toast } = useToast();
  const records = useRecords();
  const [filterVendor, setFilterVendor] = useState<string>('all');

  const filtered = useMemo(() => {
    let r = Array.isArray(records) ? records : [];
    if (filterVendor !== 'all') r = r.filter(rec => rec.vendor === filterVendor);
    return [...r].sort((a, b) => b.date.localeCompare(a.date));
  }, [records, filterVendor]);

  const handleDelete = (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    deleteRecord(id);
    toast({ title: '삭제 완료' });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-muted-foreground">필터:</span>
        <select className="h-7 border rounded px-2 text-xs bg-background" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
          <option value="all">전체</option>
          <option value="farmers">파머스</option>
          <option value="marketbom">마켓봄</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">총 {filtered.length}건</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">기록이 없습니다.</div>
      ) : (
        filtered.map(rec => (
          <CollapsibleSection
            key={rec.id}
            title={`${rec.date} | ${rec.vendor === 'farmers' ? '파머스' : '마켓봄'} | ${DAY_NAMES_KR[rec.orderDay]}요일 | ${rec.recorderType === 'manager' ? '매니저' : '스태프'}`}
            defaultOpen={false}
          >
            <table className="w-full text-xs border-collapse mb-2">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border px-1 py-0.5 text-left">품목</th>
                  <th className="border px-1 py-0.5 text-left">카테고리</th>
                  <th className="border px-1 py-0.5">입고</th>
                  <th className="border px-1 py-0.5">발주</th>
                  <th className="border px-1 py-0.5">총재고</th>
                  <th className="border px-1 py-0.5 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(rec.items) ? rec.items : []).map((item, idx) => {
                  const cfg = getItemById(item.itemId);
                  return (
                    <tr key={idx}>
                      <td className="border px-1 py-0.5">{cfg?.name || item.itemId}</td>
                      <td className="border px-1 py-0.5">{cfg?.category || ''}</td>
                      <td className="border px-1 py-0.5 text-center">{readCompatibleInbound(item) || '-'}</td>
                      <td className="border px-1 py-0.5 text-center">{item.order || '-'}</td>
                      <td className="border px-1 py-0.5 text-center font-mono">
                        {item.totalStock != null ? Math.round(item.totalStock * 100) / 100 : '-'}
                      </td>
                      <td className="border px-1 py-0.5">{item.memo || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(rec.id)}>삭제</Button>
          </CollapsibleSection>
        ))
      )}
    </div>
  );
}
