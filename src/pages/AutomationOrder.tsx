import React, { useState, useEffect, useMemo } from 'react';
import { Vendor, RecorderType, AutomationItemData, AutomationRecord } from '@/types';
import { getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { loadRecords, loadSettings } from '@/utils/storage';
import { getRecommendations } from '@/utils/recommendations';
import { addAutomationRecord, deleteAutomationDraft, getAutomationRecordsByDate, loadAutomationDraft, saveAutomationDraft } from '@/utils/automationStorage';
import { getItemsByVendor } from '@/config/items';
import { shouldShowInbound } from '@/utils/inboundLogic';
import { getKstDateString } from '@/utils/date';
import { AutoFarmersForm } from '@/components/AutoFarmersForm';
import { AutoMarketbomForm } from '@/components/AutoMarketbomForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const EXCEPTION_REASONS = ['업체 휴무', '공휴일', '배송 변경', '기타'];

export function AutomationOrder() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const settings = loadSettings();
  const today = getKstDateString();

  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [autoItems, setAutoItems] = useState<Record<string, AutomationItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayOfWeek = getDayOfWeek(date);
  const [coverDaysInput, setCoverDaysInput] = useState('');

  // Exception schedule
  const [exceptionNoDelivery, setExceptionNoDelivery] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);

  // Inbound visibility
  const showInbound = shouldShowInbound(vendor, dayOfWeek, exceptionNoDelivery);

  // Load historical records for recommendations
  const records = useMemo(() => loadRecords(), []);
  const recommendations = useMemo(
    () => getRecommendations(records, vendor, dayOfWeek, settings),
    [records, vendor, dayOfWeek, settings]
  );

  useEffect(() => {
    const draft = loadAutomationDraft(date, vendor);
    const existing = getAutomationRecordsByDate(date, vendor);

    if (draft) {
      setAutoItems(draft.autoItems);
      setRecorder(draft.recorder);
      setCoverDaysInput(draft.coverDaysInput);
      setExceptionNoDelivery(draft.exceptionNoDelivery);
      setExceptionReason(draft.exceptionReason);
      setEditingId(existing.length > 0 ? existing[0].id : null);
      return;
    }

    if (existing.length > 0) {
      const rec = existing[0];
      const dataMap: Record<string, AutomationItemData> = {};
      rec.items.forEach(item => { dataMap[item.itemId] = item; });
      setAutoItems(dataMap);
      setEditingId(rec.id);
      setRecorder(rec.recorderType);
      if (rec.coverDays && rec.coverDays.length > 0) {
        setCoverDaysInput(rec.coverDays.join(','));
      } else {
        setCoverDaysInput('');
      }
      setExceptionNoDelivery(false);
      setExceptionReason('');
    } else {
      setAutoItems({});
      setEditingId(null);
      setRecorder('manager');
      setCoverDaysInput('');
      setExceptionNoDelivery(false);
      setExceptionReason('');
    }
  }, [date, vendor]);

  const handleItemChange = (itemId: string, data: AutomationItemData) => {
    setAutoItems(prev => {
      const next = { ...prev, [itemId]: data };
      saveAutomationDraft(date, vendor, {
        autoItems: next,
        recorder,
        coverDaysInput,
        exceptionNoDelivery,
        exceptionReason,
      });
      return next;
    });
  };

  const handleSave = () => {
    const items = getItemsByVendor(vendor);
    const recordItems: AutomationItemData[] = items.map(cfg => {
      const d = autoItems[cfg.id];
      if (!d) {
        return {
          itemId: cfg.id,
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
      return d;
    });

    const coverDaysArr = coverDaysInput ? coverDaysInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    const record: AutomationRecord = {
      id: editingId || crypto.randomUUID(),
      date, vendor, recorderType: recorder, orderDay: dayOfWeek,
      coverDays: coverDaysArr,
      items: recordItems,
      createdAt: editingId ? '' : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'automation',
    };
    addAutomationRecord(record);
    deleteAutomationDraft(date, vendor);
    setEditingId(record.id);
    toast({ title: '저장 완료', description: `${date} ${vendor === 'farmers' ? '파머스' : '마켓봄'} 자동화 발주 기록이 저장되었습니다.` });
  };

  return (
    <div>
      {/* Top controls */}
      <div className={`flex flex-wrap items-center gap-3 mb-3 p-2 bg-muted/30 rounded border ${isMobile ? 'gap-2' : ''}`}>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">날짜</span>
          <Input type="date" className={`h-7 text-xs ${isMobile ? 'w-32' : 'w-36'}`} value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">업체</span>
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
              saveAutomationDraft(date, vendor, {
                autoItems,
                recorder: nextRecorder,
                coverDaysInput,
                exceptionNoDelivery,
                exceptionReason,
              });
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
            onChange={e => {
              const nextCoverDays = e.target.value;
              setCoverDaysInput(nextCoverDays);
              saveAutomationDraft(date, vendor, {
                autoItems,
                recorder,
                coverDaysInput: nextCoverDays,
                exceptionNoDelivery,
                exceptionReason,
              });
            }}
            placeholder="예: 월,화,수"
          />
        </label>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={exceptionNoDelivery}
            onChange={e => {
              const nextException = e.target.checked;
              setExceptionNoDelivery(nextException);
              saveAutomationDraft(date, vendor, {
                autoItems,
                recorder,
                coverDaysInput,
                exceptionNoDelivery: nextException,
                exceptionReason,
              });
            }}
            className="rounded"
          />
          <span className="text-muted-foreground">오늘 입고 없음 (예외)</span>
        </label>

        {exceptionNoDelivery && (
          <label className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">사유:</span>
            <select
              className="h-7 border rounded px-2 text-xs bg-background"
              value={exceptionReason}
              onChange={e => {
                const nextReason = e.target.value;
                setExceptionReason(nextReason);
                saveAutomationDraft(date, vendor, {
                  autoItems,
                  recorder,
                  coverDaysInput,
                  exceptionNoDelivery,
                  exceptionReason: nextReason,
                });
              }}
            >
              <option value="">선택</option>
              {EXCEPTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}

        {showInbound && (
          <span className="text-xs text-orange-600 font-medium">📦 입고일 (이전 발주분 자동 표시)</span>
        )}
      </div>

      {/* Automation form */}
      {vendor === 'farmers' ? (
        <AutoFarmersForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
          showInbound={showInbound}
        />
      ) : (
        <AutoMarketbomForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
          showInbound={showInbound}
        />
      )}

      {/* Save */}
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={handleSave}>
          {editingId ? '수정 저장' : '발주 저장'}
        </Button>
      </div>
    </div>
  );
}
