import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import type { AppSettings, AutomationRecord, DailyRecord } from '@/types';
import { db } from './firebase';

const USERS_COLLECTION = 'users';
const RECORDS_COLLECTION = 'records';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'current';
const AUTOMATION_COLLECTION = 'automationRecords';
const FIRESTORE_BATCH_LIMIT = 450;

let activeUid: string | null = null;
let unsubscribeSession: (() => void) | null = null;

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
      ? record.items
          .filter((item): item is NonNullable<typeof item> => typeof item === 'object' && item !== null)
          .map((item) => ({
            ...item,
            itemId: typeof item.itemId === 'string' ? item.itemId : '',
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

function normalizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    trackingWeeks: settings?.trackingWeeks === 4 ? 4 : 2,
    meatPacksPerTray: {
      'm-beef': 10,
      'm-pork': 10,
      'm-chicken': 10,
      ...(settings?.meatPacksPerTray ?? {}),
    },
  };
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
      ? record.items
          .filter((item): item is NonNullable<typeof item> => typeof item === 'object' && item !== null)
          .map((item) => ({
            ...item,
            itemId: typeof item.itemId === 'string' ? item.itemId : '',
            currentStockValues:
              typeof item.currentStockValues === 'object' && item.currentStockValues !== null
                ? { ...item.currentStockValues }
                : {},
            currentStock: Number(item.currentStock) || 0,
            inboundRef: item.inboundRef ?? '',
            defaultOrderCandidate: Number(item.defaultOrderCandidate) || 0,
            minThresholdCandidate: Number(item.minThresholdCandidate) || 0,
            recommendedOrder: Number(item.recommendedOrder) || 0,
            finalOrder: Number(item.finalOrder) || 0,
            memo: typeof item.memo === 'string' ? item.memo : '',
          }))
      : [],
    createdAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : createdAt,
    type: 'automation',
  };
}

function recordsRef(uid: string) {
  return collection(db, USERS_COLLECTION, uid, RECORDS_COLLECTION);
}

function recordDocRef(uid: string, id: string) {
  return doc(db, USERS_COLLECTION, uid, RECORDS_COLLECTION, id);
}

function settingsDocRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
}

function automationRef(uid: string) {
  return collection(db, USERS_COLLECTION, uid, AUTOMATION_COLLECTION);
}

function automationDocRef(uid: string, id: string) {
  return doc(db, USERS_COLLECTION, uid, AUTOMATION_COLLECTION, id);
}

async function readLocalState() {
  const storage = await import('@/utils/storage');
  const automationStorage = await import('@/utils/automationStorage');
  return {
    records: storage.loadRecords().map(normalizeRecord),
    settings: normalizeSettings(storage.loadSettings()),
    automationRecords: automationStorage.loadAutomationRecords().map(normalizeAutomationRecord),
  };
}

async function mergeLocalRecords(records: DailyRecord[]) {
  const storage = await import('@/utils/storage');
  storage.mergeRecordsFromRemote(records);
}

async function mergeLocalAutomationRecords(records: AutomationRecord[]) {
  const automationStorage = await import('@/utils/automationStorage');
  automationStorage.mergeAutomationRecordsFromRemote(records);
}

async function replaceRemoteRecords(uid: string, records: DailyRecord[]) {
  const normalized = records.map(normalizeRecord);

  for (let start = 0; start < normalized.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = normalized.slice(start, start + FIRESTORE_BATCH_LIMIT);

    for (const record of chunk) {
      batch.set(recordDocRef(uid, record.id), record);
    }

    await batch.commit();
  }
}

async function replaceRemoteSettings(uid: string, settings: AppSettings) {
  await setDoc(settingsDocRef(uid), normalizeSettings(settings));
}

async function replaceRemoteAutomationRecords(uid: string, records: AutomationRecord[]) {
  const normalized = records.map(normalizeAutomationRecord);

  for (let start = 0; start < normalized.length; start += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = normalized.slice(start, start + FIRESTORE_BATCH_LIMIT);

    for (const record of chunk) {
      batch.set(automationDocRef(uid, record.id), record);
    }

    await batch.commit();
  }
}

async function loadRemoteRecords(uid: string): Promise<DailyRecord[]> {
  const snap = await getDocs(recordsRef(uid));
  return snap.docs.map((snapshot) => normalizeRecord({ id: snapshot.id, ...(snapshot.data() as Partial<DailyRecord>) }));
}

async function loadRemoteSettings(uid: string): Promise<AppSettings | null> {
  const snap = await getDoc(settingsDocRef(uid));
  if (!snap.exists()) return null;
  return normalizeSettings(snap.data() as Partial<AppSettings>);
}

async function loadRemoteAutomationRecords(uid: string): Promise<AutomationRecord[]> {
  const snap = await getDocs(automationRef(uid));
  return snap.docs.map((snapshot) =>
    normalizeAutomationRecord({ id: snapshot.id, ...(snapshot.data() as Partial<AutomationRecord>) })
  );
}

export function getFirestoreUid() {
  return activeUid;
}

export async function connectFirestoreSession(uid: string): Promise<() => void> {
  if (unsubscribeSession) {
    unsubscribeSession();
    unsubscribeSession = null;
  }

  activeUid = uid;

  const local = await readLocalState();
  const storage = await import('@/utils/storage');
  const automationStorage = await import('@/utils/automationStorage');
  const [remoteRecords, remoteSettings, remoteAutomationRecords] = await Promise.all([
    loadRemoteRecords(uid),
    loadRemoteSettings(uid),
    loadRemoteAutomationRecords(uid),
  ]);

  storage.mergeRecordsFromRemote(remoteRecords);
  automationStorage.mergeAutomationRecordsFromRemote(remoteAutomationRecords);

  if (remoteRecords.length > 0 || local.records.length > 0) {
    await replaceRemoteRecords(uid, storage.loadRecords());
  }

  if (remoteAutomationRecords.length > 0 || local.automationRecords.length > 0) {
    await replaceRemoteAutomationRecords(uid, automationStorage.loadAutomationRecords());
  }

  const settings = remoteSettings ?? local.settings;
  storage.replaceSettingsFromRemote(settings);
  if (remoteSettings === null) {
    await replaceRemoteSettings(uid, settings);
  }

  const unsubscribeRecords = onSnapshot(recordsRef(uid), (snapshot) => {
    const records = snapshot.docs.map((item) =>
      normalizeRecord({ id: item.id, ...(item.data() as Partial<DailyRecord>) })
    );
    if (records.length === 0) return;
    void mergeLocalRecords(records);
  });

  const unsubscribeSettings = onSnapshot(settingsDocRef(uid), (snapshot) => {
    if (!snapshot.exists()) return;
    storage.replaceSettingsFromRemote(normalizeSettings(snapshot.data() as Partial<AppSettings>));
  });

  const unsubscribeAutomation = onSnapshot(automationRef(uid), (snapshot) => {
    const records = snapshot.docs.map((item) =>
      normalizeAutomationRecord({ id: item.id, ...(item.data() as Partial<AutomationRecord>) })
    );
    if (records.length === 0) return;
    void mergeLocalAutomationRecords(records);
  });

  unsubscribeSession = () => {
    unsubscribeRecords();
    unsubscribeSettings();
    unsubscribeAutomation();
    activeUid = null;
  };

  return unsubscribeSession;
}

export async function replaceRecordsInFirestore(records: DailyRecord[]) {
  if (!activeUid) return;
  await replaceRemoteRecords(activeUid, records);
}

export async function replaceSettingsInFirestore(settings: AppSettings) {
  if (!activeUid) return;
  await replaceRemoteSettings(activeUid, settings);
}

export async function replaceAutomationRecordsInFirestore(records: AutomationRecord[]) {
  if (!activeUid) return;
  await replaceRemoteAutomationRecords(activeUid, records);
}

export async function deleteRecordFromFirestore(id: string) {
  if (!activeUid) return;
  await deleteDoc(recordDocRef(activeUid, id));
}

export async function deleteAutomationRecordFromFirestore(id: string) {
  if (!activeUid) return;
  await deleteDoc(automationDocRef(activeUid, id));
}

export async function clearFirestoreSession() {
  if (unsubscribeSession) {
    unsubscribeSession();
    unsubscribeSession = null;
  }
  activeUid = null;
}

