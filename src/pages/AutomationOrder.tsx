import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Vendor, RecorderType, AutomationItemData, AutomationRecord } from '@/types';
import { getCoverDays, getDayOfWeek, DAY_NAMES_KR, getOrderDays } from '@/config/ordering';
import { useRecords, useSettings } from '@/utils/storage';
import { useAutomationRecords } from '@/utils/automationStorage';
import { buildSafeCoverageRecommendationPlan, getRecommendationAudits, getRecommendations } from '@/utils/recommendations';
import { addAutomationRecord, deleteAutomationDraft, getAutomationRecordsByDate, loadAutomationDraft, saveAutomationDraft } from '@/utils/automationStorage';
import { getItemsByVendor } from '@/config/items';
import { getAutoInboundFromPrevOrder, getAutoInboundSignature, shouldShowInbound } from '@/utils/inboundLogic';
import { getKstDateString } from '@/utils/date';
import { AutoFarmersForm } from '@/components/AutoFarmersForm';
import { AutoMarketbomForm } from '@/components/AutoMarketbomForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { convertStockToOrderUnits, normalizeOrderQuantityWithPolicy } from '@/utils/itemUnits';
import { getLeadDays } from '@/config/ordering';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const EXCEPTION_REASONS = ['업체 휴무', '공휴일', '배송 변경', '기타'];

function countCoverDays(value: string): number {
  return value
    .split(',')
    .map(day => day.trim())
    .filter(Boolean)
    .length;
}

function createBlankAutoItems(vendor: Vendor, autoInbound: Record<string, number>): Record<string, AutomationItemData> {
  const items = getItemsByVendor(vendor);
  const result: Record<string, AutomationItemData> = {};

  for (const item of items) {
    const next: AutomationItemData = {
      itemId: item.id,
      currentStock: 0,
      currentStockValues: {},
      inboundRef: '',
      defaultOrderCandidate: 0,
      minThresholdCandidate: 0,
      recommendedOrder: 0,
      finalOrder: 0,
      memo: '',
    };
    const value = autoInbound[item.id];
    if (value !== undefined) {
      next.inboundRef = String(value);
    }
    result[item.id] = next;
  }

  return result;
}

function mergeAutoInboundDefaults(
  autoItems: Record<string, AutomationItemData>,
  vendor: Vendor,
  autoInbound: Record<string, number>
): { autoItems: Record<string, AutomationItemData>; applied: boolean } {
  const next: Record<string, AutomationItemData> = {};
  let applied = false;

  for (const [itemId, current] of Object.entries(autoItems)) {
    const item = { ...current, currentStockValues: { ...(current.currentStockValues || {}) } };
    const value = autoInbound[itemId];
    if (value !== undefined && (item.inboundRef === '' || item.inboundRef === undefined || item.inboundRef === null)) {
      item.inboundRef = String(value);
      applied = true;
    }
    next[itemId] = item;
  }

  return { autoItems: next, applied };
}

export function AutomationOrder() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const settings = useSettings();
  const today = getKstDateString();

  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState<Vendor>('farmers');
  const [recorder, setRecorder] = useState<RecorderType>('manager');
  const [autoItems, setAutoItems] = useState<Record<string, AutomationItemData>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const autoInboundSeededRef = useRef(false);

  const dayOfWeek = getDayOfWeek(date);
  const [coverDaysInput, setCoverDaysInput] = useState('');

  // Exception schedule
  const [exceptionNoDelivery, setExceptionNoDelivery] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  const orderDays = getOrderDays(vendor);
  const isOrderDay = orderDays.includes(dayOfWeek);
  const defaultCoverDays = getCoverDays(vendor, dayOfWeek);
  const defaultCoverDaysCount = useMemo(() => countCoverDays(defaultCoverDays), [defaultCoverDays]);
  const effectiveCoverDaysInput = coverDaysInput.trim() ? coverDaysInput : defaultCoverDays;
  const coverDaysCount = useMemo(() => countCoverDays(effectiveCoverDaysInput), [effectiveCoverDaysInput]);
  const leadDaysCount = getLeadDays(vendor);

  // Inbound visibility
  const showInbound = shouldShowInbound(vendor, dayOfWeek, exceptionNoDelivery);

  // Load historical records for recommendations
  const records = useRecords();
  const automationRecords = useAutomationRecords();
  const autoInbound = useMemo(
    () => {
      void records;
      void automationRecords;
      return getAutoInboundFromPrevOrder(date, vendor, dayOfWeek);
    },
    [date, vendor, dayOfWeek, records, automationRecords]
  );
  const autoInboundSignature = useMemo(() => getAutoInboundSignature(autoInbound), [autoInbound]);
  const recommendations = useMemo(
    () => getRecommendations(records, vendor, dayOfWeek, settings, automationRecords),
    [records, vendor, dayOfWeek, settings, automationRecords]
  );
  const recommendationAudits = useMemo(
    () => getRecommendationAudits(records, vendor, dayOfWeek, automationRecords),
    [records, vendor, dayOfWeek, automationRecords]
  );

  useEffect(() => {
    const draft = loadAutomationDraft(date, vendor);
    const existing = getAutomationRecordsByDate(date, vendor);

    if (draft) {
      autoInboundSeededRef.current = !!draft.autoInboundSeeded || draft.autoInboundSignature === autoInboundSignature;
      let nextAutoItems = draft.autoItems;
      if (showInbound && draft.autoInboundSignature !== autoInboundSignature) {
        const merged = mergeAutoInboundDefaults(draft.autoItems, vendor, autoInbound);
        nextAutoItems = merged.autoItems;
        if (merged.applied || draft.autoInboundSignature !== autoInboundSignature) {
          autoInboundSeededRef.current = merged.applied || autoInboundSeededRef.current;
          saveAutomationDraft(date, vendor, {
            ...draft,
            autoItems: nextAutoItems,
            autoInboundSeeded: autoInboundSeededRef.current,
            autoInboundSignature,
          });
        }
      }
      setAutoItems(nextAutoItems);
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
      autoInboundSeededRef.current = false;
      let nextAutoItems = dataMap;
      if (showInbound) {
        const merged = mergeAutoInboundDefaults(dataMap, vendor, autoInbound);
        if (merged.applied) {
          nextAutoItems = merged.autoItems;
          autoInboundSeededRef.current = true;
          saveAutomationDraft(date, vendor, {
            autoItems: nextAutoItems,
            recorder: rec.recorderType,
            coverDaysInput: rec.coverDays?.length ? rec.coverDays.join(',') : '',
            exceptionNoDelivery: false,
            exceptionReason: '',
            autoInboundSeeded: true,
            autoInboundSignature,
          });
        }
      }
      setAutoItems(nextAutoItems);
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
      const autoFilled = showInbound ? createBlankAutoItems(vendor, autoInbound) : {};
      autoInboundSeededRef.current = false;
      setAutoItems(autoFilled);
      setEditingId(null);
      setRecorder('manager');
      setCoverDaysInput('');
      setExceptionNoDelivery(false);
      setExceptionReason('');

      if (showInbound && Object.values(autoFilled).some(item => item.inboundRef !== '')) {
        autoInboundSeededRef.current = true;
        saveAutomationDraft(date, vendor, {
          autoItems: autoFilled,
          recorder: 'manager',
          coverDaysInput: '',
          exceptionNoDelivery: false,
          exceptionReason: '',
          autoInboundSeeded: true,
          autoInboundSignature,
        });
      }
    }
  }, [date, vendor, dayOfWeek, showInbound, autoInbound, autoInboundSignature]);

  const handleItemChange = (itemId: string, data: AutomationItemData) => {
    setAutoItems(prev => {
      const next = { ...prev, [itemId]: data };
      saveAutomationDraft(date, vendor, {
        autoItems: next,
        recorder,
        coverDaysInput,
        exceptionNoDelivery,
        exceptionReason,
        autoInboundSeeded: autoInboundSeededRef.current,
      });
      return next;
    });
  };

  const handleSave = () => {
    const items = getItemsByVendor(vendor);
    const existingRecord = editingId
      ? getAutomationRecordsByDate(date, vendor).find(record => record.id === editingId)
      : undefined;
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
      return {
        ...d,
        recommendedOrder: (() => {
          const rec = recommendations[cfg.id];
          const plan = buildSafeCoverageRecommendationPlan(
            cfg.id,
            convertStockToOrderUnits(cfg.id, d.currentStock, settings),
            d.defaultOrderCandidate,
            coverDaysCount,
            defaultCoverDaysCount,
            leadDaysCount,
            {
              medianOrderCandidate: rec?.medianOrderCandidate,
              trainingRecordCount: rec?.trainingRecordCount,
            }
          );
          return normalizeOrderQuantityWithPolicy(cfg.id, plan.recommendedRaw, {
            averageOrderCandidate: d.defaultOrderCandidate,
            medianOrderCandidate: rec?.medianOrderCandidate,
            carryOverRatio: plan.carryOverRatio,
          }).value;
        })(),
      };
    });

    const coverDaysArr = coverDaysInput ? coverDaysInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    const record: AutomationRecord = {
      id: editingId || crypto.randomUUID(),
      date, vendor, recorderType: recorder, orderDay: dayOfWeek,
      coverDays: coverDaysArr,
      items: recordItems,
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
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
                autoInboundSeeded: autoInboundSeededRef.current,
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
                autoInboundSeeded: autoInboundSeededRef.current,
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
                autoInboundSeeded: autoInboundSeededRef.current,
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
                  autoInboundSeeded: autoInboundSeededRef.current,
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
          coverDaysCount={coverDaysCount}
          defaultCoverDaysCount={defaultCoverDaysCount}
          leadDaysCount={leadDaysCount}
          recommendationAudits={recommendationAudits}
        />
      ) : (
        <AutoMarketbomForm
          data={autoItems}
          onChange={handleItemChange}
          recommendations={recommendations}
          settings={settings}
          showInbound={showInbound}
          coverDaysCount={coverDaysCount}
          defaultCoverDaysCount={defaultCoverDaysCount}
          leadDaysCount={leadDaysCount}
          recommendationAudits={recommendationAudits}
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
