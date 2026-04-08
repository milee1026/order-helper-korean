import React, { useState, useEffect, useMemo } from 'react';
import { Vendor, RecorderType, AutomationItemData, AutomationRecord } from '@/types';
import { getCoverDays, getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { loadRecords, loadSettings } from '@/utils/storage';
import { getRecommendations, computeRecommendedOrder } from '@/utils/recommendations';
import { addAutomationRecord, getAutomationRecordsByDate } from '@/utils/automationStorage';
import { normalizeOrderQuantity } from '@/utils/itemUnits';
import { getItemsByVendor, FARMERS_ITEMS, MARKETBOM_ITEMS } from '@/config/items';
import { AutoFarmersForm } from '@/components/AutoFarmersForm';
import { AutoMarketbomForm } from '@/components/AutoMarketbomForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

export function AutomationOrder() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const settings = loadSettings();
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [autoItems, setAutoItems] = useState<Record<string, AutomationItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const dayOfWeek = getDayOfWeek(date);
  const coverDays = getCoverDays(vendor, dayOfWeek);
  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);

  // Load historical records for recommendations
  const records = useMemo(() => loadRecords(), []);
  const recommendations = useMemo(
    () => getRecommendations(records, vendor, dayOfWeek, settings),
    [records, vendor, dayOfWeek, settings]
  );

  // Load existing automation record for this date+vendor
  useEffect(() => {
    const existing = getAutomationRecordsByDate(date, vendor);
    if (existing.length > 0) {
      const rec = existing[0];
      const dataMap: Record<string, AutomationItemData> = {};
      rec.items.forEach(item => { dataMap[item.itemId] = item; });
      setAutoItems(dataMap);
      setEditingId(rec.id);
      setRecorder(rec.recorderType);
    } else {
      setAutoItems({});
      setEditingId(null);
    }
  }, [date, vendor]);

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

    const record: AutomationRecord = {
      id: editingId || crypto.randomUUID(),
      date, vendor, recorderType: recorder, orderDay: dayOfWeek,
      coverDays: coverDays ? coverDays.split(',') : [],
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
            <option value="staff">직원</option>
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

      {/* Automation form */}
      {vendor === 'farmers' ? (
        <AutoFarmersForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
        />
      ) : (
        <AutoMarketbomForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
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
