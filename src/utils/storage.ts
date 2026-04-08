import { useSyncExternalStore } from 'react';

import type { AppSettings, DailyRecord, ItemData, RecorderType } from '@/types';
import { replaceRecordsInFirestore, replaceSettingsInFirestore } from '@/lib/firestoreSync';

const RECORDS_KEY = 'inventory-records';
const SETTINGS_KEY = 'inventory-settings';

export interface DraftData {
  itemData: Record<string, ItemData>;
  recorder: RecorderType;
}

export const defaultSettings: AppSettings = {
  trackingWeeks: 2,
  meatPacksPerTray: { 'm-beef': 10, 'm-pork': 10, 'm-chicken': 10 },
};

const recordListeners = new Set<() => void>();
const settingsListeners = new Set<() => void>();
const draftListeners = new Set<() => void>();

let recordsCache: DailyRecord[] = readJson(RECORDS_KEY, []);
let settingsCache: AppSettings = normalizeSettings(readJson(SETTINGS_KEY, defaultSettings));
let draftsCache: Record<string, DraftData> = {};

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
    // Keep the in-memory cache even if browser storage is unavailable.
  }
}

function emit(listeners: Set<() => void>) {
  listeners.forEach((listener) => listener());
}

function normalizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    trackingWeeks: settings?.trackingWeeks === 4 ? 4 : 2,
    meatPacksPerTray: {
      ...defaultSettings.meatPacksPerTray,
      ...(settings?.meatPacksPerTray ?? {}),
    },
  };
}

function normalizeRecord(record: Partial<DailyRecord>): DailyRecord {
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
          values: typeof item.values === 'object' && item.values !== null ? { ...item.values } : {},
          inbound: item.inbound ?? '',
          order: item.order ?? '',
          memo: typeof item.memo === 'string' ? item.memo : '',
        }))
      : [],
    createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : createdAt,
  };
}

function recordTimestamp(record: Pick<DailyRecord, 'createdAt' | 'updatedAt'>) {
  return Date.parse(record.updatedAt || record.createdAt || '') || 0;
}

function mergeRecords(current: DailyRecord[], incoming: DailyRecord[]): DailyRecord[] {
  const next = current.map(normalizeRecord);
  const indexById = new Map(next.map((record, index) => [record.id, index]));

  for (const record of incoming.map(normalizeRecord)) {
    const index = indexById.get(record.id);
    if (index === undefined) {
      indexById.set(record.id, next.length);
      next.push(record);
      continue;
    }

    const existing = next[index];
    if (recordTimestamp(record) >= recordTimestamp(existing)) {
      next[index] = record;
    }
  }

  return next;
}

function draftKey(date: string, vendor: string): string {
  return `${date}__${vendor}`;
}

export function loadRecords(): DailyRecord[] {
  return recordsCache;
}

export function useRecords(): DailyRecord[] {
  return useSyncExternalStore(
    (listener) => {
      recordListeners.add(listener);
      return () => recordListeners.delete(listener);
    },
    loadRecords,
    loadRecords,
  );
}

export function saveRecords(records: DailyRecord[]) {
  recordsCache = records.map(normalizeRecord);
  writeJson(RECORDS_KEY, recordsCache);
  emit(recordListeners);
  void replaceRecordsInFirestore(recordsCache);
}

export function addRecord(record: DailyRecord) {
  const records = loadRecords();
  const idx = records.findIndex((entry) => entry.id === record.id);
  const next = idx >= 0 ? records.map((entry, i) => (i === idx ? record : entry)) : [...records, record];
  saveRecords(next);
}

export function deleteRecord(id: string) {
  saveRecords(loadRecords().filter((record) => record.id !== id));
}

export function getRecordsByDate(date: string): DailyRecord[] {
  return loadRecords().filter((record) => record.date === date);
}

export function getRecordsByVendor(vendor: string): DailyRecord[] {
  return loadRecords().filter((record) => record.vendor === vendor);
}

export function loadSettings(): AppSettings {
  return settingsCache;
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (listener) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    loadSettings,
    loadSettings,
  );
}

export function saveSettings(settings: AppSettings) {
  settingsCache = normalizeSettings(settings);
  writeJson(SETTINGS_KEY, settingsCache);
  emit(settingsListeners);
  void replaceSettingsInFirestore(settingsCache);
}

export function saveDraft(date: string, vendor: string, draft: DraftData) {
  try {
    draftsCache = {
      ...draftsCache,
      [draftKey(date, vendor)]: draft,
    };
    emit(draftListeners);
  } catch {
    // Ignore draft persistence failures and keep the editor usable.
  }
}

export function loadDraft(date: string, vendor: string): DraftData | null {
  return draftsCache[draftKey(date, vendor)] ?? null;
}

export function deleteDraft(date: string, vendor: string) {
  try {
    const next = { ...draftsCache };
    delete next[draftKey(date, vendor)];
    draftsCache = next;
    emit(draftListeners);
  } catch {
    // Ignore draft deletion failures.
  }
}

export function mergeRecordsFromRemote(records: DailyRecord[]) {
  recordsCache = mergeRecords(recordsCache, records);
  writeJson(RECORDS_KEY, recordsCache);
  emit(recordListeners);
}

export function replaceRecordsFromRemote(records: DailyRecord[]) {
  recordsCache = records.map(normalizeRecord);
  writeJson(RECORDS_KEY, recordsCache);
  emit(recordListeners);
}

export function mergeSettingsFromRemote(settings: AppSettings) {
  settingsCache = normalizeSettings(settings);
  writeJson(SETTINGS_KEY, settingsCache);
  emit(settingsListeners);
}

export function replaceSettingsFromRemote(settings: AppSettings) {
  settingsCache = normalizeSettings(settings);
  writeJson(SETTINGS_KEY, settingsCache);
  emit(settingsListeners);
}
