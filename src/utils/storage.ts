import { DailyRecord, AppSettings } from '@/types';

const RECORDS_KEY = 'inventory-records';
const SETTINGS_KEY = 'inventory-settings';

export const defaultSettings: AppSettings = {
  trackingWeeks: 2,
  meatPacksPerTray: { 'm-beef': 10, 'm-pork': 10, 'm-chicken': 10 },
};

export function loadRecords(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveRecords(records: DailyRecord[]) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function addRecord(record: DailyRecord) {
  const records = loadRecords();
  const idx = records.findIndex(r => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  saveRecords(records);
}

export function deleteRecord(id: string) {
  saveRecords(loadRecords().filter(r => r.id !== id));
}

export function getRecordsByDate(date: string): DailyRecord[] {
  return loadRecords().filter(r => r.date === date);
}

export function getRecordsByVendor(vendor: string): DailyRecord[] {
  return loadRecords().filter(r => r.vendor === vendor);
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch { return defaultSettings; }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
