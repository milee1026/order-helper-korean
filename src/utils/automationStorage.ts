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

let automationDraftsCache: Record<string, AutomationDraft> = {};

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

function normalizeAutomationRecord(record: AutomationRecord): AutomationRecord {
  return {
    ...record,
    items: record.items.map(normalizeAutomationItem),
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

function draftKey(date: string, vendor: string): string {
  return `${date}__${vendor}`;
}

export function loadAutomationRecords(): AutomationRecord[] {
  try {
    const raw = localStorage.getItem(AUTO_RECORDS_KEY);
    const records = raw ? (JSON.parse(raw) as AutomationRecord[]) : [];
    const normalized = records.map(normalizeAutomationRecord);
    if (raw && JSON.stringify(normalized) !== raw) {
      localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function loadAutomationDrafts(): Record<string, AutomationDraft> {
  return automationDraftsCache;
}

export function saveAutomationRecords(records: AutomationRecord[]) {
  const normalized = records.map(normalizeAutomationRecord);
  localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(normalized));
  void replaceAutomationRecordsInFirestore(normalized);
}

export function replaceAutomationRecordsFromRemote(records: AutomationRecord[]) {
  localStorage.setItem(AUTO_RECORDS_KEY, JSON.stringify(records.map(normalizeAutomationRecord)));
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
