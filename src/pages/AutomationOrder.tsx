import React, { useState, useEffect, useMemo } from 'react';
import { Vendor, RecorderType, AutomationItemData, AutomationRecord } from '@/types';
import { getCoverDays, getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { useRecords, useSettings } from '@/utils/storage';
import { getRecommendations, computeRecommendedOrder } from '@/utils/recommendations';
import { addAutomationRecord, useAutomationRecords } from '@/utils/automationStorage';
import { normalizeOrderQuantity } from '@/utils/itemUnits';
import { getItemsByVendor, FARMERS_ITEMS, MARKETBOM_ITEMS } from '@/config/items';
import { shouldShowInbound, getAutoInboundFromPrevOrder } from '@/utils/inboundLogic';
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
  const settings = useSettings();
  const records = useRecords();
  const automationRecords = useAutomationRecords();
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [autoItems, setAutoItems] = useState<Record<string, AutomationItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Editable cover days
  const dayOfWeek = getDayOfWeek(date);
  const defaultCoverDays = getCoverDays(vendor, dayOfWeek);
  const [coverDaysInput, setCoverDaysInput] = useState(defaultCoverDays);

  // Exception schedule
  const [exceptionNoDelivery, setExceptionNoDelivery] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);
  const existingAutomationRecord = useMemo(() => {
    return automationRecords.find(r => r.date === date && r.vendor === vendor) || null;
  }, [automationRecords, date, vendor]);

  // Inbound visibility
  const showInbound = shouldShowInbound(vendor, dayOfWeek, exceptionNoDelivery);

  // Auto inbound from previous order
  const autoInbound = useMemo(() => {
    if (!showInbound) return {};
    return getAutoInboundFromPrevOrder(date, vendor, dayOfWeek);
  }, [date, vendor, dayOfWeek, showInbound]);

  // Load historical records for recommendations
  const recommendations = useMemo(
    () => getRecommendations(records, vendor, dayOfWeek, settings),
    [records, vendor, dayOfWeek, settings]
  );

  // Reset cover days when date/vendor changes
  useEffect(() => {
    const newDefault = getCoverDays(vendor, getDayOfWeek(date));
    setCoverDaysInput(newDefault);
    setExceptionNoDelivery(false);
    setExceptionReason('');
  }, [date, vendor]);

  useEffect(() => {
    if (existingAutomationRecord) {
      const dataMap: Record<string, AutomationItemData> = {};
      existingAutomationRecord.items.forEach(item => { dataMap[item.itemId] = item; });
      setAutoItems(dataMap);
      setEditingId(existingAutomationRecord.id);
      setRecorder(existingAutomationRecord.recorderType);
      // Restore saved cover days if present
      if (existingAutomationRecord.coverDays && existingAutomationRecord.coverDays.length > 0) {
        setCoverDaysInput(existingAutomationRecord.coverDays.join(','));
      }
    } else {
      // Auto-fill inbound for new records
      if (showInbound && Object.keys(autoInbound).length > 0) {
        const prefilled: Record<string, AutomationItemData> = {};
        for (const [itemId, qty] of Object.entries(autoInbound)) {
          prefilled[itemId] = {
            itemId,
            currentStock: 0,
            currentStockValues: {},
            inboundRef: qty,
            defaultOrderCandidate: recommendations[itemId]?.defaultOrderCandidate || 0,
            minThresholdCandidate: recommendations[itemId]?.minThresholdCandidate || 0,
            recommendedOrder: 0,
            finalOrder: 0,
            memo: '',
          };
        }
        setAutoItems(prefilled);
      } else {
        setAutoItems({});
      }
      setEditingId(null);
    }
  }, [date, vendor, existingAutomationRecord?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleItemChange = (itemId: string, data: AutomationItemData) => {
    setAutoItems(prev => ({ ...prev, [itemId]: data }));
  };

  const handleSave = () => {
    const items = getItemsByVendor(vendor);
    const recordItems: AutomationItemData[] = items.map(cfg => {
      const d = autoItems[cfg.id];
      if (!d) {
        const recData = recommendations[cfg.id];
        const defOrd = normalizeOrderQuantity(cfg.id, recData?.defaultOrderCandidate || 0);
        return {
          itemId: cfg.id,
          currentStock: 0,
          currentStockValues: {},
          inboundRef: 0,
          defaultOrderCandidate: defOrd,
          minThresholdCandidate: recData?.minThresholdCandidate || 0,
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

      {/* Automation form */}
      {vendor === 'farmers' ? (
        <AutoFarmersForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
          showInbound={showInbound}
          autoInbound={autoInbound}
        />
      ) : (
        <AutoMarketbomForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
          showInbound={showInbound}
          autoInbound={autoInbound}
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
