import { useSyncExternalStore } from 'react';

import type { AutomationRecord } from '@/types';

const AUTO_RECORDS_KEY = 'automation-records';

type AutomationSyncAdapter = {
  upsertRecord?: (record: AutomationRecord) => Promise<void> | void;
  deleteRecord?: (recordId: string) => Promise<void> | void;
};

const listeners = new Set<() => void>();

let syncAdapter: AutomationSyncAdapter | null = null;
let automationRecordsCache: AutomationRecord[] = readJson(AUTO_RECORDS_KEY, []);

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory cache even if browser storage fails.
  }
}

function normalizeAutomationRecord(record: Partial<AutomationRecord>): AutomationRecord {
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
  return {
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    date: typeof record.date === 'string' ? record.date : '',
    vendor: record.vendor === 'marketbom' ? 'marketbom' : 'farmers',
    recorderType: record.recorderType === 'staff' ? 'staff' : 'manager',
    orderDay: typeof record.orderDay === 'number' ? record.orderDay : Number(record.orderDay ?? 0) || 0,
    coverDays: Array.isArray(record.coverDays) ? record.coverDays.map((day) => String(day)) : [],
    items: Array.isArray(record.items)
      ? record.items.map((item) => ({
          ...item,
          currentStock: Number(item.currentStock ?? 0) || 0,
          currentStockValues:
            typeof item.currentStockValues === 'object' && item.currentStockValues !== null
              ? { ...item.currentStockValues }
              : {},
          inboundRef: item.inboundRef ?? 0,
          defaultOrderCandidate: Number(item.defaultOrderCandidate ?? 0) || 0,
          minThresholdCandidate: Number(item.minThresholdCandidate ?? 0) || 0,
          recommendedOrder: Number(item.recommendedOrder ?? 0) || 0,
          finalOrder: Number(item.finalOrder ?? 0) || 0,
          memo: typeof item.memo === 'string' ? item.memo : '',
        }))
      : [],
    createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : createdAt,
    type: 'automation',
  };
}

function getTimestamp(record: Pick<AutomationRecord, 'createdAt' | 'updatedAt'>) {
  return Date.parse(record.updatedAt || record.createdAt || '') || 0;
}

function mergeAutomationRecords(current: AutomationRecord[], incoming: AutomationRecord[]): AutomationRecord[] {
  const next = current.map(normalizeAutomationRecord);
  const indexById = new Map(next.map((record, index) => [record.id, index]));

  for (const record of incoming.map(normalizeAutomationRecord)) {
    const index = indexById.get(record.id);
    if (index === undefined) {
      indexById.set(record.id, next.length);
      next.push(record);
      continue;
    }

    const existing = next[index];
    if (getTimestamp(record) >= getTimestamp(existing)) {
      next[index] = record;
    }
  }

  return next;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function registerAutomationSyncAdapter(adapter: AutomationSyncAdapter | null) {
  syncAdapter = adapter;
}

export function loadAutomationRecords(): AutomationRecord[] {
  return automationRecordsCache;
}

export function useAutomationRecords(): AutomationRecord[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadAutomationRecords,
    loadAutomationRecords,
  );
}

export function replaceAutomationRecordsFromRemote(records: AutomationRecord[]) {
  automationRecordsCache = mergeAutomationRecords(automationRecordsCache, records);
  writeJson(AUTO_RECORDS_KEY, automationRecordsCache);
  emit();
}

export function mergeAutomationRecordsFromRemote(records: AutomationRecord[]) {
  replaceAutomationRecordsFromRemote(records);
}

export function saveAutomationRecords(records: AutomationRecord[]) {
  const next = records.map(normalizeAutomationRecord);
  const previous = automationRecordsCache;
  automationRecordsCache = next;
  writeJson(AUTO_RECORDS_KEY, automationRecordsCache);
  emit();

  if (!syncAdapter) return;

  const prevById = new Map(previous.map((record) => [record.id, record]));
  const nextById = new Map(next.map((record) => [record.id, record]));

  for (const record of next) {
    const current = prevById.get(record.id);
    if (!current || JSON.stringify(current) !== JSON.stringify(record)) {
      void Promise.resolve(syncAdapter.upsertRecord?.(record)).catch(() => {});
    }
  }

  for (const id of prevById.keys()) {
    if (!nextById.has(id)) {
      void Promise.resolve(syncAdapter.deleteRecord?.(id)).catch(() => {});
    }
  }
}

export function addAutomationRecord(record: AutomationRecord) {
  const records = loadAutomationRecords();
  const idx = records.findIndex((entry) => entry.id === record.id);
  const next = idx >= 0 ? records.map((entry, i) => (i === idx ? record : entry)) : [...records, record];
  saveAutomationRecords(next);
}

export function deleteAutomationRecord(id: string) {
  saveAutomationRecords(loadAutomationRecords().filter((record) => record.id !== id));
}

export function getAutomationRecordsByDate(date: string, vendor?: string): AutomationRecord[] {
  return loadAutomationRecords().filter((record) => record.date === date && (!vendor || record.vendor === vendor));
}
