import { AutomationItemData, AutomationRecord, RecorderType } from '@/types';

const AUTO_RECORDS_KEY = 'automation-records';
const AUTO_DRAFTS_KEY = 'automation-drafts';

export interface AutomationDraft {
  autoItems: Record<string, AutomationItemData>;
  recorder: RecorderType;
  coverDaysInput: string;
  exceptionNoDelivery: boolean;
  exceptionReason: string;
}

function draftKey(date: string, vendor: string): string {
  return `${date}__${vendor}`;
}

export function loadAutomationRecords(): AutomationRecord[] {
  try {
    const raw = localStorage.getItem(AUTO_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadAutomationDrafts(): Record<string, AutomationDraft> {
  try {
    const raw = localStorage.getItem(AUTO_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
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

export function loadAutomationDraft(date: string, vendor: string): AutomationDraft | null {
  return loadAutomationDrafts()[draftKey(date, vendor)] ?? null;
}

export function saveAutomationDraft(date: string, vendor: string, draft: AutomationDraft) {
  const drafts = loadAutomationDrafts();
  drafts[draftKey(date, vendor)] = draft;
  localStorage.setItem(AUTO_DRAFTS_KEY, JSON.stringify(drafts));
}

export function deleteAutomationDraft(date: string, vendor: string) {
  const drafts = loadAutomationDrafts();
  delete drafts[draftKey(date, vendor)];
  localStorage.setItem(AUTO_DRAFTS_KEY, JSON.stringify(drafts));
}
