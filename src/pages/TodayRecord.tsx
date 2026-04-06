import React, { useState, useEffect, useCallback } from 'react';
import { DailyRecord, ItemData, Vendor, RecorderType } from '@/types';
import { getItemsByVendor, FARMERS_ITEMS } from '@/config/items';
import { getCoverDays, getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { addRecord, getRecordsByDate, loadSettings, saveDraft, loadDraft, deleteDraft } from '@/utils/storage';
import { FarmersForm } from '@/components/FarmersForm';
import { MarketbomForm } from '@/components/MarketbomForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export function TodayRecord() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const settings = loadSettings();
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [itemData, setItemData] = useState<Record<string, ItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayOfWeek = getDayOfWeek(date);
  const coverDays = getCoverDays(vendor, dayOfWeek);
  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);

  // Load existing record or draft for this date+vendor
  useEffect(() => {
    const existing = getRecordsByDate(date).find(r => r.vendor === vendor);
    if (existing) {
      const dataMap: Record<string, ItemData> = {};
      existing.items.forEach(item => { dataMap[item.itemId] = item; });
      setItemData(dataMap);
      setEditingId(existing.id);
      setRecorder(existing.recorderType);
    } else {
      const draft = loadDraft(date, vendor);
      if (draft) {
        setItemData(draft.itemData);
        setRecorder(draft.recorder);
      } else {
        setItemData({});
      }
      setEditingId(null);
    }
  }, [date, vendor]);

  // Auto-save draft on every change
  const handleItemChange = useCallback((itemId: string, d: ItemData) => {
    setItemData(prev => {
      const next = { ...prev, [itemId]: { ...d, itemId } };
      return next;
    });
  }, []);

  // Persist draft to localStorage whenever itemData, recorder, date, or vendor changes
  useEffect(() => {
    // Only save draft if there's actual data and no saved record yet
    const hasData = Object.keys(itemData).some(k => {
      const d = itemData[k];
      return d && (Object.values(d.values).some(v => v !== '' && v !== 0) || d.memo);
    });
    if (hasData && !editingId) {
      saveDraft(date, vendor, { itemData, recorder });
    }
  }, [itemData, recorder, date, vendor, editingId]);

  const handleSave = () => {
    const items = getItemsByVendor(vendor);
    const recordItems: ItemData[] = items.map(cfg => {
      const d = itemData[cfg.id];
      if (!d) return { itemId: cfg.id, values: {}, inbound: '', order: '', memo: '' };
      const total = cfg.computeTotal ? cfg.computeTotal(d.values as Record<string, number>, settings) : undefined;
      return { ...d, totalStock: total };
    });

    const record: DailyRecord = {
      id: editingId || crypto.randomUUID(),
      date, vendor, recorderType: recorder, orderDay: dayOfWeek,
      coverDays: coverDays ? coverDays.split(',') : [],
      items: recordItems,
      createdAt: editingId ? '' : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addRecord(record);
    setEditingId(record.id);
    deleteDraft(date, vendor);
    setItemData({});
    toast({ title: '저장 완료', description: `${date} ${vendor === 'farmers' ? '파머스' : '마켓봄'} 기록이 저장되었습니다.` });
  };

  const handleDuplicate = () => {
    const newDate = prompt('복사할 날짜를 입력하세요 (YYYY-MM-DD):', today);
    if (!newDate) return;
    const items = getItemsByVendor(vendor);
    const recordItems: ItemData[] = items.map(cfg => {
      const d = itemData[cfg.id];
      if (!d) return { itemId: cfg.id, values: {}, inbound: '', order: '', memo: '' };
      return { ...d };
    });
    const newDay = getDayOfWeek(newDate);
    const record: DailyRecord = {
      id: crypto.randomUUID(),
      date: newDate, vendor, recorderType: recorder, orderDay: newDay,
      coverDays: getCoverDays(vendor, newDay).split(',').filter(Boolean),
      items: recordItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addRecord(record);
    toast({ title: '복사 완료', description: `${newDate}로 기록이 복사되었습니다.` });
  };

  return (
    <div>
      {/* Controls */}
      <div className={`flex flex-wrap items-center gap-3 mb-3 p-2 bg-muted/30 rounded border ${isMobile ? 'gap-2' : ''}`}>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">날짜</span>
          <Input type="date" className={`h-7 text-xs ${isMobile ? 'w-32' : 'w-36'}`} value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">거래처</span>
          <select className={`h-7 border rounded px-2 text-xs bg-background ${isMobile ? 'flex-1' : ''}`} value={vendor} onChange={e => setVendor(e.target.value as Vendor)}>
            <option value="farmers">파머스</option>
            <option value="marketbom">마켓봄</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">기록자</span>
          <select className="h-7 border rounded px-2 text-xs bg-background" value={recorder} onChange={e => setRecorder(e.target.value as RecorderType)}>
            <option value="manager">매니저</option>
            <option value="staff">스태프</option>
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">요일:</span>
          <span className="font-medium">{DAY_NAMES_KR[dayOfWeek]}요일</span>
          {isOrderDay ? (
            <span className="text-primary font-medium">✓ 발주일</span>
          ) : (
            <span className="text-destructive">✗ 비발주일</span>
          )}
        </div>
        {coverDays && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">커버일:</span>
            <span className="font-medium">{coverDays}</span>
          </div>
        )}
      </div>

      {/* Form */}
      {vendor === 'farmers' ? (
        <FarmersForm data={itemData} onChange={handleItemChange} />
      ) : (
        <MarketbomForm data={itemData} onChange={handleItemChange} settings={settings} />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={handleSave}>
          {editingId ? '수정 저장' : '저장'}
        </Button>
        {vendor === 'farmers' && (
          <Button size="sm" variant="outline" onClick={() => {
            const cleared: Record<string, ItemData> = {};
            FARMERS_ITEMS.forEach(item => {
              cleared[item.id] = { itemId: item.id, values: {}, inbound: '', order: '', memo: '' };
            });
            setItemData(prev => {
              const next = { ...prev };
              FARMERS_ITEMS.forEach(item => { next[item.id] = cleared[item.id]; });
              return next;
            });
          }}>
            초기화
          </Button>
        )}
        {editingId && (
          <Button size="sm" variant="outline" onClick={handleDuplicate}>
            다른 날짜로 복사
          </Button>
        )}
      </div>
    </div>
  );
}
