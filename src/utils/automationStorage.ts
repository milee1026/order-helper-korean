import { AutomationRecord } from '@/types';

const AUTO_RECORDS_KEY = 'automation-records';

export function loadAutomationRecords(): AutomationRecord[] {
  try {
    const raw = localStorage.getItem(AUTO_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAutomationRecords(records: AutomationRecord[]) {
  localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(records));
}

export function addAutomationRecord(record: AutomationRecord) {
  const records = loadAutomationRecords();
  const idx = records.findIndex(r => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  saveAutomationRecords(records);
}

export function getAutomationRecordsByDate(date: string, vendor?: string): AutomationRecord[] {
  return loadAutomationRecords().filter(r => r.date === date && (!vendor || r.vendor === vendor));
}
