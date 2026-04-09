import { useSyncExternalStore } from 'react';

import { AutomationItemData, AutomationRecord, RecorderType } from '@/types';
import { replaceAutomationRecordsInFirestore } from '@/lib/firestoreSync';

const AUTO_RECORDS_KEY = 'automation-records';

export interface AutomationDraft {
  autoItems: Record<string, AutomationItemData>;
  recorder: RecorderType;
  coverDaysInput: string;
  exceptionNoDelivery: boolean;
  exceptionReason: string;
  autoInboundSeeded?: boolean;
}

const automationListeners = new Set<() => void>();
let automationRecordsCache: AutomationRecord[] = normalizeAutomationRecordList(readJson(AUTO_RECORDS_KEY, []));
let automationDraftsCache: Record<string, AutomationDraft> = {};

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function emitAutomationListeners() {
  automationListeners.forEach((listener) => listener());
}

function isLegacyAutoFillArtifact(item: AutomationItemData): boolean {
  const keys = Object.keys(item.currentStockValues || {});
  return item.itemId === 'ms-med-teri'
    && keys.length === 1
    && keys[0] === 'usedRatio'
    && Number(item.currentStockValues.usedRatio) === 0.2;
}

function normalizeAutomationItem(item: AutomationItemData): AutomationItemData {
  if (!isLegacyAutoFillArtifact(item)) return item;
  return {
    ...item,
    currentStockValues: {},
    currentStock: 0,
    defaultOrderCandidate: 0,
    minThresholdCandidate: 0,
    recommendedOrder: 0,
  };
}

function normalizeAutomationRecord(record: Partial<AutomationRecord>): AutomationRecord {
  return {
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    date: typeof record.date === 'string' ? record.date : '',
    vendor: record.vendor === 'marketbom' ? 'marketbom' : 'farmers',
    recorderType: record.recorderType === 'staff' ? 'staff' : 'manager',
    orderDay: typeof record.orderDay === 'number' ? record.orderDay : Number(record.orderDay ?? 0) || 0,
    coverDays: Array.isArray(record.coverDays) ? record.coverDays.map((day) => String(day)) : [],
    items: Array.isArray(record.items)
      ? record.items
          .filter((item): item is AutomationItemData => typeof item === 'object' && item !== null)
          .map(normalizeAutomationItem)
      : [],
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    type: 'automation',
  };
}

function normalizeAutomationDraft(draft: AutomationDraft): AutomationDraft {
  return {
    ...draft,
    autoItems: Object.fromEntries(
      Object.entries(draft.autoItems).map(([itemId, item]) => [itemId, normalizeAutomationItem(item)])
    ),
  };
}

function normalizeAutomationRecordList(records: Partial<AutomationRecord>[]): AutomationRecord[] {
  return records.map((record) => normalizeAutomationRecord(record));
}

function draftKey(date: string, vendor: string): string {
  return `${date}__${vendor}`;
}

export function loadAutomationRecords(): AutomationRecord[] {
  return automationRecordsCache;
}

export function useAutomationRecords(): AutomationRecord[] {
  return useSyncExternalStore(
    (listener) => {
      automationListeners.add(listener);
      return () => automationListeners.delete(listener);
    },
    loadAutomationRecords,
    loadAutomationRecords,
  );
}

function loadAutomationDrafts(): Record<string, AutomationDraft> {
  return automationDraftsCache;
}

export function saveAutomationRecords(records: AutomationRecord[]) {
  automationRecordsCache = normalizeAutomationRecordList(records);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(automationRecordsCache));
    }
  } catch {
    // Keep the in-memory cache even if browser storage is unavailable.
  }
  emitAutomationListeners();
  void replaceAutomationRecordsInFirestore(automationRecordsCache);
}

export function replaceAutomationRecordsFromRemote(records: AutomationRecord[]) {
  automationRecordsCache = normalizeAutomationRecordList(records);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(automationRecordsCache));
    }
  } catch {
    // Keep the in-memory cache even if browser storage is unavailable.
  }
  emitAutomationListeners();
}

export function addAutomationRecord(record: AutomationRecord) {
  const records = loadAutomationRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  saveAutomationRecords(records);
}

export function getAutomationRecordsByDate(date: string, vendor?: string): AutomationRecord[] {
  return loadAutomationRecords().filter((r) => r.date === date && (!vendor || r.vendor === vendor));
}

export function loadAutomationDraft(date: string, vendor: string): AutomationDraft | null {
  const draft = loadAutomationDrafts()[draftKey(date, vendor)] ?? null;
  return draft ? normalizeAutomationDraft(draft) : null;
}

export function saveAutomationDraft(date: string, vendor: string, draft: AutomationDraft) {
  automationDraftsCache = {
    ...automationDraftsCache,
    [draftKey(date, vendor)]: normalizeAutomationDraft(draft),
  };
}

export function deleteAutomationDraft(date: string, vendor: string) {
  const next = { ...automationDraftsCache };
  delete next[draftKey(date, vendor)];
  automationDraftsCache = next;
}
