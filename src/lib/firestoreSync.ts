import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { AppSettings, AutomationRecord, DailyRecord } from '@/types';
import {
  defaultSettings,
  loadRecords,
  loadSettings,
  mergeRecordsFromRemote,
  mergeSettingsFromRemote,
  registerInventorySyncAdapter,
  replaceRecordsFromRemote,
  replaceSettingsFromRemote,
} from '@/utils/storage';
import {
  loadAutomationRecords,
  mergeAutomationRecordsFromRemote,
  registerAutomationSyncAdapter,
  replaceAutomationRecordsFromRemote,
} from '@/utils/automationStorage';

const RECORDS_COLLECTION = 'records';
const AUTOMATION_COLLECTION = 'automationRecords';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC = 'current';
const META_COLLECTION = 'meta';
const META_DOC = 'sync';

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeVendor(vendor: unknown): 'farmers' | 'marketbom' {
  return vendor === 'marketbom' ? 'marketbom' : 'farmers';
}

function normalizeRecorderType(recorderType: unknown): 'manager' | 'staff' {
  return recorderType === 'staff' ? 'staff' : 'manager';
}

function normalizeDateString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeItemData(item: Record<string, unknown>): DailyRecord['items'][number] {
  return {
    itemId: typeof item.itemId === 'string' ? item.itemId : '',
    values: isRecordLike(item.values) ? { ...item.values } : {},
    inbound: item.inbound ?? '',
    order: item.order ?? '',
    memo: typeof item.memo === 'string' ? item.memo : '',
    totalStock: typeof item.totalStock === 'number' ? item.totalStock : undefined,
  };
}

function normalizeDailyRecord(value: unknown): DailyRecord {
  const record = isRecordLike(value) ? value : {};
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
  return {
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    date: normalizeDateString(record.date),
    vendor: normalizeVendor(record.vendor),
    recorderType: normalizeRecorderType(record.recorderType),
    orderDay: typeof record.orderDay === 'number' ? record.orderDay : Number(record.orderDay ?? 0) || 0,
    coverDays: Array.isArray(record.coverDays) ? record.coverDays.map((day) => String(day)) : [],
    items: Array.isArray(record.items)
      ? record.items
          .filter(isRecordLike)
          .map((item) => normalizeItemData(item))
      : [],
    createdAt,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : createdAt,
  };
}

function normalizeAutomationItemData(item: Record<string, unknown>): AutomationRecord['items'][number] {
  return {
    itemId: typeof item.itemId === 'string' ? item.itemId : '',
    currentStock: typeof item.currentStock === 'number' ? item.currentStock : Number(item.currentStock ?? 0) || 0,
    currentStockValues: isRecordLike(item.currentStockValues) ? { ...item.currentStockValues } : {},
    inboundRef: item.inboundRef ?? 0,
    defaultOrderCandidate:
      typeof item.defaultOrderCandidate === 'number'
        ? item.defaultOrderCandidate
        : Number(item.defaultOrderCandidate ?? 0) || 0,
    minThresholdCandidate:
      typeof item.minThresholdCandidate === 'number'
        ? item.minThresholdCandidate
        : Number(item.minThresholdCandidate ?? 0) || 0,
    recommendedOrder:
      typeof item.recommendedOrder === 'number'
        ? item.recommendedOrder
        : Number(item.recommendedOrder ?? 0) || 0,
    finalOrder:
      typeof item.finalOrder === 'number'
        ? item.finalOrder
        : Number(item.finalOrder ?? 0) || 0,
    memo: typeof item.memo === 'string' ? item.memo : '',
  };
}

function normalizeAutomationRecord(value: unknown): AutomationRecord {
  const record = isRecordLike(value) ? value : {};
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();
  return {
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    date: normalizeDateString(record.date),
    vendor: normalizeVendor(record.vendor),
    recorderType: normalizeRecorderType(record.recorderType),
    orderDay: typeof record.orderDay === 'number' ? record.orderDay : Number(record.orderDay ?? 0) || 0,
    coverDays: Array.isArray(record.coverDays) ? record.coverDays.map((day) => String(day)) : [],
    items: Array.isArray(record.items)
      ? record.items
          .filter(isRecordLike)
          .map((item) => normalizeAutomationItemData(item))
      : [],
    createdAt,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : createdAt,
    type: 'automation',
  };
}

function normalizeSettingsPayload(value: unknown): AppSettings {
  const payload = isRecordLike(value) && isRecordLike(value.settings) ? value.settings : value;
  const raw = isRecordLike(payload) ? payload : {};
  const trackingWeeks = Number(raw.trackingWeeks) === 4 ? 4 : defaultSettings.trackingWeeks;
  const meatPacksPerTray = {
    ...defaultSettings.meatPacksPerTray,
    ...(isRecordLike(raw.meatPacksPerTray) ? raw.meatPacksPerTray : {}),
  };

  return {
    trackingWeeks,
    meatPacksPerTray: Object.fromEntries(
      Object.entries(meatPacksPerTray).map(([key, value]) => [key, Number(value) || 10]),
    ),
  };
}

function getRecordTimestamp(record: Pick<DailyRecord, 'createdAt' | 'updatedAt'>): number {
  return Date.parse(record.updatedAt || record.createdAt || '') || 0;
}

function getAutomationTimestamp(record: Pick<AutomationRecord, 'createdAt' | 'updatedAt'>): number {
  return Date.parse(record.updatedAt || record.createdAt || '') || 0;
}

function mergeDailyRecords(base: DailyRecord[], incoming: DailyRecord[]): DailyRecord[] {
  const next = base.map(normalizeDailyRecord);
  const indexById = new Map(next.map((record, index) => [record.id, index]));

  for (const record of incoming.map(normalizeDailyRecord)) {
    const index = indexById.get(record.id);
    if (index === undefined) {
      indexById.set(record.id, next.length);
      next.push(record);
      continue;
    }

    const current = next[index];
    if (getRecordTimestamp(record) >= getRecordTimestamp(current)) {
      next[index] = record;
    }
  }

  return next;
}

function mergeAutomationRecords(base: AutomationRecord[], incoming: AutomationRecord[]): AutomationRecord[] {
  const next = base.map(normalizeAutomationRecord);
  const indexById = new Map(next.map((record, index) => [record.id, index]));

  for (const record of incoming.map(normalizeAutomationRecord)) {
    const index = indexById.get(record.id);
    if (index === undefined) {
      indexById.set(record.id, next.length);
      next.push(record);
      continue;
    }

    const current = next[index];
    if (getAutomationTimestamp(record) >= getAutomationTimestamp(current)) {
      next[index] = record;
    }
  }

  return next;
}

async function loadRemoteRecords(uid: string): Promise<DailyRecord[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, RECORDS_COLLECTION));
  return snapshot.docs.map((entry) => normalizeDailyRecord({ id: entry.id, ...entry.data() }));
}

async function loadRemoteAutomationRecords(uid: string): Promise<AutomationRecord[]> {
  const snapshot = await getDocs(collection(db, 'users', uid, AUTOMATION_COLLECTION));
  return snapshot.docs.map((entry) => normalizeAutomationRecord({ id: entry.id, ...entry.data() }));
}

async function loadRemoteSettings(uid: string): Promise<AppSettings | null> {
  const snapshot = await getDoc(doc(db, 'users', uid, SETTINGS_COLLECTION, SETTINGS_DOC));
  if (!snapshot.exists()) return null;
  return normalizeSettingsPayload(snapshot.data());
}

async function loadMigrationMeta(uid: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid, META_COLLECTION, META_DOC));
    return Boolean(snapshot.exists() && snapshot.data().migrationComplete);
  } catch {
    return false;
  }
}

async function writeSnapshotToFirestore(uid: string) {
  const records = loadRecords();
  const automationRecords = loadAutomationRecords();
  const settings = loadSettings();

  await Promise.all([
    ...records.map((record) =>
      setDoc(doc(db, 'users', uid, RECORDS_COLLECTION, record.id), record, { merge: true }),
    ),
    ...automationRecords.map((record) =>
      setDoc(doc(db, 'users', uid, AUTOMATION_COLLECTION, record.id), record, { merge: true }),
    ),
    setDoc(
      doc(db, 'users', uid, SETTINGS_COLLECTION, SETTINGS_DOC),
      {
        settings,
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      },
      { merge: true },
    ),
    setDoc(
      doc(db, 'users', uid, META_COLLECTION, META_DOC),
      {
        migrationComplete: true,
        migratedAt: new Date().toISOString(),
        schemaVersion: 1,
      },
      { merge: true },
    ),
  ]);
}

function startRealtimeSync(uid: string) {
  const unsubscribers = [
    onSnapshot(collection(db, 'users', uid, RECORDS_COLLECTION), (snapshot) => {
      const remoteRecords = snapshot.docs.map((entry) =>
        normalizeDailyRecord({ id: entry.id, ...entry.data() }),
      );
      mergeRecordsFromRemote(remoteRecords);
    }),
    onSnapshot(collection(db, 'users', uid, AUTOMATION_COLLECTION), (snapshot) => {
      const remoteRecords = snapshot.docs.map((entry) =>
        normalizeAutomationRecord({ id: entry.id, ...entry.data() }),
      );
      mergeAutomationRecordsFromRemote(remoteRecords);
    }),
    onSnapshot(doc(db, 'users', uid, SETTINGS_COLLECTION, SETTINGS_DOC), (snapshot) => {
      if (!snapshot.exists()) return;
      mergeSettingsFromRemote(normalizeSettingsPayload(snapshot.data()));
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

async function bootstrapRemoteData(uid: string) {
  const [recordsResult, automationResult, settingsResult, migratedResult] = await Promise.allSettled([
    loadRemoteRecords(uid),
    loadRemoteAutomationRecords(uid),
    loadRemoteSettings(uid),
    loadMigrationMeta(uid),
  ]);

  const remoteRecords = recordsResult.status === 'fulfilled' ? recordsResult.value : [];
  const remoteAutomation =
    automationResult.status === 'fulfilled' ? automationResult.value : [];
  const remoteSettings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
  const alreadyMigrated = migratedResult.status === 'fulfilled' ? migratedResult.value : false;

  const localRecords = loadRecords();
  const localAutomation = loadAutomationRecords();
  const localSettings = loadSettings();

  const mergedRecords = mergeDailyRecords(localRecords, remoteRecords);
  const mergedAutomation = mergeAutomationRecords(localAutomation, remoteAutomation);
  const mergedSettings = remoteSettings ?? localSettings;

  replaceRecordsFromRemote(mergedRecords);
  replaceAutomationRecordsFromRemote(mergedAutomation);
  replaceSettingsFromRemote(mergedSettings);

  if (!alreadyMigrated) {
    await writeSnapshotToFirestore(uid);
  }
}

export async function connectFirestoreSession(uid: string): Promise<() => void> {
  registerInventorySyncAdapter({
    async upsertRecord(record) {
      await setDoc(doc(db, 'users', uid, RECORDS_COLLECTION, record.id), record, { merge: true });
    },
    async deleteRecord(recordId) {
      await deleteDoc(doc(db, 'users', uid, RECORDS_COLLECTION, recordId));
    },
    async upsertSettings(settings) {
      await setDoc(
        doc(db, 'users', uid, SETTINGS_COLLECTION, SETTINGS_DOC),
        {
          settings,
          updatedAt: new Date().toISOString(),
          schemaVersion: 1,
        },
        { merge: true },
      );
    },
  });

  registerAutomationSyncAdapter({
    async upsertRecord(record) {
      await setDoc(doc(db, 'users', uid, AUTOMATION_COLLECTION, record.id), record, {
        merge: true,
      });
    },
    async deleteRecord(recordId) {
      await deleteDoc(doc(db, 'users', uid, AUTOMATION_COLLECTION, recordId));
    },
  });

  try {
    await bootstrapRemoteData(uid);
    const stopRealtimeSync = startRealtimeSync(uid);

    return () => {
      stopRealtimeSync();
      registerInventorySyncAdapter(null);
      registerAutomationSyncAdapter(null);
    };
  } catch (error) {
    registerInventorySyncAdapter(null);
    registerAutomationSyncAdapter(null);
    throw error;
  }
}
