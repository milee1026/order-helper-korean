import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DailyRecord, ItemData, Vendor, RecorderType } from '@/types';
import { getItemsByVendor, FARMERS_ITEMS } from '@/config/items';
import { getCoverDays, getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { addRecord, getRecordsByDate, deleteRecord, loadSettings, saveDraft, loadDraft, deleteDraft } from '@/utils/storage';
import { getAutoInboundFromPrevOrder, shouldShowInbound } from '@/utils/inboundLogic';
import { getKstDateString } from '@/utils/date';
import { FarmersForm } from '@/components/FarmersForm';
import { MarketbomForm } from '@/components/MarketbomForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const EXCEPTION_REASONS = ['업체 휴무', '공휴일', '배송 변경', '기타'];

function createBlankItemData(vendor: Vendor, date: string, dayOfWeek: number): Record<string, ItemData> {
  const autoInbound = getAutoInboundFromPrevOrder(date, vendor, dayOfWeek);
  const items = getItemsByVendor(vendor);
  const result: Record<string, ItemData> = {};

  for (const item of items) {
    const next: ItemData = { itemId: item.id, values: {}, inbound: '', order: '', memo: '' };
    const value = autoInbound[item.id];

    if (value !== undefined) {
      if (vendor === 'farmers' && item.id === 'f-broccoli') {
        next.values = { ...next.values, inboundKg: value };
      } else {
        next.inbound = String(value);
      }
    }

    result[item.id] = next;
  }

  return result;
}

function mergeAutoInboundDefaults(
  itemData: Record<string, ItemData>,
  vendor: Vendor,
  date: string,
  dayOfWeek: number
): { itemData: Record<string, ItemData>; applied: boolean } {
  const autoInbound = getAutoInboundFromPrevOrder(date, vendor, dayOfWeek);
  const next: Record<string, ItemData> = {};
  let applied = false;

  for (const [itemId, current] of Object.entries(itemData)) {
    const item = { ...current, values: { ...(current.values || {}) } };
    const value = autoInbound[itemId];

    if (value !== undefined) {
      if (vendor === 'farmers' && itemId === 'f-broccoli') {
        if (item.values.inboundKg === '' || item.values.inboundKg === undefined || item.values.inboundKg === null) {
          item.values.inboundKg = value;
          applied = true;
        }
      } else if (item.inbound === '' || item.inbound === undefined || item.inbound === null) {
        item.inbound = String(value);
        applied = true;
      }
    }

    next[itemId] = item;
  }

  return { itemData: next, applied };
}

export function TodayRecord() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const settings = loadSettings();
  const today = getKstDateString();
  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [itemData, setItemData] = useState<Record<string, ItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const autoInboundSeededRef = useRef(false);

  const dayOfWeek = getDayOfWeek(date);
  const defaultCoverDays = getCoverDays(vendor, dayOfWeek);
  const [coverDaysInput, setCoverDaysInput] = useState(defaultCoverDays);
  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);

  // Exception schedule
  const [exceptionNoDelivery, setExceptionNoDelivery] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  // Inbound visibility
  const showInbound = shouldShowInbound(vendor, dayOfWeek, exceptionNoDelivery);

  // Reset cover days when date/vendor changes
  useEffect(() => {
    setCoverDaysInput(getCoverDays(vendor, getDayOfWeek(date)));
    setExceptionNoDelivery(false);
    setExceptionReason('');
  }, [date, vendor]);

  // Load draft first, then fall back to saved record
  useEffect(() => {
    const draft = loadDraft(date, vendor);
    const existing = getRecordsByDate(date).find(r => r.vendor === vendor);

    if (draft) {
      autoInboundSeededRef.current = !!draft.autoInboundSeeded;
      let nextItemData = draft.itemData;
      if (showInbound && !draft.autoInboundSeeded) {
        const merged = mergeAutoInboundDefaults(draft.itemData, vendor, date, dayOfWeek);
        nextItemData = merged.itemData;
        if (merged.applied) {
          autoInboundSeededRef.current = true;
          saveDraft(date, vendor, {
            itemData: nextItemData,
            recorder: draft.recorder,
            autoInboundSeeded: true,
          });
        }
      }
      setItemData(nextItemData);
      setRecorder(draft.recorder);
      setEditingId(existing ? existing.id : null);
      setCoverDaysInput(existing?.coverDays?.join(',') || getCoverDays(vendor, dayOfWeek));
      return;
    }

    if (existing) {
      const dataMap: Record<string, ItemData> = {};
      existing.items.forEach(item => { dataMap[item.itemId] = item; });
      autoInboundSeededRef.current = false;
      setItemData(dataMap);
      setEditingId(existing.id);
      setRecorder(existing.recorderType);
      setCoverDaysInput(existing.coverDays?.join(',') || getCoverDays(vendor, dayOfWeek));
      return;
    }

    const autoFilled = showInbound ? createBlankItemData(vendor, date, dayOfWeek) : {};
    autoInboundSeededRef.current = false;
    setItemData(autoFilled);
    setEditingId(null);
    setRecorder('manager');
    setCoverDaysInput(getCoverDays(vendor, dayOfWeek));

    if (showInbound && Object.values(autoFilled).some(item => item.inbound !== '' || Object.keys(item.values || {}).length > 0)) {
      autoInboundSeededRef.current = true;
      saveDraft(date, vendor, { itemData: autoFilled, recorder: 'manager', autoInboundSeeded: true });
    }
  }, [date, vendor, dayOfWeek, showInbound]);

  const handleItemChange = useCallback((itemId: string, d: ItemData) => {
      setItemData(prev => {
        const next = { ...prev, [itemId]: { ...d, itemId } };
      saveDraft(date, vendor, { itemData: next, recorder, autoInboundSeeded: autoInboundSeededRef.current });
        return next;
      });
  }, [date, vendor, recorder]);

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
      coverDays: coverDaysInput ? coverDaysInput.split(',').map(s => s.trim()).filter(Boolean) : [],
      items: recordItems,
      createdAt: editingId ? '' : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addRecord(record);
    setEditingId(record.id);
    deleteDraft(date, vendor);
    toast({ title: '저장 완료', description: `${date} ${vendor === 'farmers' ? '파머스' : '마켓봄'} 기록이 저장되었습니다.` });
  };

  const handleDuplicate = () => {
    const newDate = prompt('복사할 날짜를 입력하세요 (YYYY-MM-DD):', today);
    if (!newDate) return;

    const existingRecord = getRecordsByDate(newDate).find(r => r.vendor === vendor);
    if (existingRecord) {
      const overwrite = confirm(`${newDate}에 이미 ${vendor === 'farmers' ? '파머스' : '마켓봄'} 기록이 있습니다.\n기존 기록을 새 기록으로 덮어쓰시겠습니까?`);
      if (!overwrite) return;
      deleteRecord(existingRecord.id);
    }

    const items = getItemsByVendor(vendor);
    const recordItems: ItemData[] = items.map(cfg => {
      const d = itemData[cfg.id];
      if (!d) return { itemId: cfg.id, values: {}, inbound: '', order: '', memo: '' };
      const total = cfg.computeTotal ? cfg.computeTotal(d.values as Record<string, number>, settings) : undefined;
      return { ...d, totalStock: total };
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
          <select
            className="h-7 border rounded px-2 text-xs bg-background"
            value={recorder}
            onChange={e => {
              const nextRecorder = e.target.value as RecorderType;
              setRecorder(nextRecorder);
              saveDraft(date, vendor, { itemData, recorder: nextRecorder, autoInboundSeeded: autoInboundSeededRef.current });
            }}
          >
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
      </div>

      {/* Cover days + Exception controls */}
      <div className={`flex flex-wrap items-center gap-3 mb-3 p-2 bg-muted/20 rounded border ${isMobile ? 'flex-col items-start gap-2' : ''}`}>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">커버일:</span>
          <Input
            className="h-7 text-xs w-40"
            value={coverDaysInput}
            onChange={e => setCoverDaysInput(e.target.value)}
            placeholder="예: 월,화,수"
          />
          {coverDaysInput !== defaultCoverDays && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-1 text-muted-foreground" onClick={() => setCoverDaysInput(defaultCoverDays)}>
              초기화
            </Button>
          )}
        </label>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={exceptionNoDelivery}
            onChange={e => setExceptionNoDelivery(e.target.checked)}
            className="rounded"
          />
          <span className="text-muted-foreground">오늘 입고 없음 (예외)</span>
        </label>

        {exceptionNoDelivery && (
          <label className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">사유:</span>
            <select className="h-7 border rounded px-2 text-xs bg-background" value={exceptionReason} onChange={e => setExceptionReason(e.target.value)}>
              <option value="">선택</option>
              {EXCEPTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}

        {showInbound && (
          <span className="text-xs text-orange-600 font-medium">📦 입고일 (이전 발주분 자동 표시)</span>
        )}
      </div>

      {/* Form */}
      {vendor === 'farmers' ? (
        <FarmersForm data={itemData} onChange={handleItemChange} showInbound={showInbound} />
      ) : (
        <MarketbomForm data={itemData} onChange={handleItemChange} settings={settings} showInbound={showInbound} />
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
            setItemData(cleared);
            deleteDraft(date, vendor);
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
