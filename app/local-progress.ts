export type LocalProgressState = {
  answers?: Record<string, string>;
  completed?: Record<string, boolean>;
  deferred?: Record<string, boolean>;
  currentDay?: number;
};

type ProgressEnvelope = {
  schemaVersion: 2;
  savedAt: string;
  label: string;
  state: LocalProgressState;
};

type SnapshotRecord = ProgressEnvelope & {
  id: string;
};

const DATABASE_NAME = 'talent-to-value-local';
const DATABASE_VERSION = 1;
const PROGRESS_STORE = 'progress';
const SNAPSHOT_STORE = 'snapshots';
const CURRENT_KEY = 'current';
const LEGACY_STORAGE_KEY = 'talent-to-value-demo-v1';
const LATEST_BACKUP_KEY = 'talent-to-value-backup-latest';
const CORRUPT_BACKUP_KEY = 'talent-to-value-corrupt-backup';
const MAX_SNAPSHOTS = 10;
const AUTO_SNAPSHOT_INTERVAL = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProgressState(value: unknown): value is LocalProgressState {
  if (!isRecord(value)) return false;
  const answersValid = value.answers === undefined || (
    isRecord(value.answers) && Object.values(value.answers).every((answer) => typeof answer === 'string')
  );
  const completedValid = value.completed === undefined || (
    isRecord(value.completed) && Object.values(value.completed).every((item) => typeof item === 'boolean')
  );
  const deferredValid = value.deferred === undefined || (
    isRecord(value.deferred) && Object.values(value.deferred).every((item) => typeof item === 'boolean')
  );
  const dayValid = value.currentDay === undefined || (
    typeof value.currentDay === 'number' && Number.isFinite(value.currentDay)
  );
  return answersValid && completedValid && deferredValid && dayValid;
}

function parseEnvelope(value: unknown): ProgressEnvelope | null {
  if (isRecord(value) && isProgressState(value.state)) {
    return {
      schemaVersion: 2,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
      label: typeof value.label === 'string' ? value.label : '本地进度',
      state: value.state,
    };
  }
  if (isProgressState(value)) {
    return {
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      label: '旧版本地进度',
      state: value,
    };
  }
  return null;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        database.createObjectStore(PROGRESS_STORE);
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const snapshots = database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
        snapshots.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

function createEnvelope(state: LocalProgressState, label: string): ProgressEnvelope {
  return {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    label,
    state,
  };
}

function stateHasContent(state: LocalProgressState) {
  return Boolean(
    Object.values(state.answers ?? {}).some((value) => value.trim())
    || Object.values(state.completed ?? {}).some(Boolean)
    || Object.values(state.deferred ?? {}).some(Boolean),
  );
}

async function trimSnapshots(database: IDBDatabase) {
  const readTransaction = database.transaction(SNAPSHOT_STORE, 'readonly');
  const readComplete = transactionToPromise(readTransaction);
  const records = await requestToPromise(readTransaction.objectStore(SNAPSHOT_STORE).getAll()) as SnapshotRecord[];
  await readComplete;
  const expired = records
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(MAX_SNAPSHOTS);
  if (!expired.length) return;
  const deleteTransaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
  const deleteComplete = transactionToPromise(deleteTransaction);
  const store = deleteTransaction.objectStore(SNAPSHOT_STORE);
  expired.forEach((record) => store.delete(record.id));
  await deleteComplete;
}

async function saveSnapshotToDatabase(database: IDBDatabase, envelope: ProgressEnvelope) {
  const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
  const complete = transactionToPromise(transaction);
  const record: SnapshotRecord = {
    ...envelope,
    id: `${envelope.savedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  transaction.objectStore(SNAPSHOT_STORE).put(record);
  await complete;
  await trimSnapshots(database);
}

function saveLegacyMirror(envelope: ProgressEnvelope) {
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(envelope.state));
  window.localStorage.setItem(LATEST_BACKUP_KEY, JSON.stringify(envelope));
}

function loadLegacyEnvelope() {
  const values = [
    window.localStorage.getItem(LATEST_BACKUP_KEY),
    window.localStorage.getItem(LEGACY_STORAGE_KEY),
  ];
  for (const raw of values) {
    if (!raw) continue;
    try {
      const envelope = parseEnvelope(JSON.parse(raw));
      if (envelope) return envelope;
    } catch {
      try {
        window.localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch {
        // Keep trying the remaining local source.
      }
    }
  }
  return null;
}

export async function loadLocalProgress() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(PROGRESS_STORE, 'readonly');
    const complete = transactionToPromise(transaction);
    const stored = await requestToPromise(transaction.objectStore(PROGRESS_STORE).get(CURRENT_KEY));
    await complete;
    database.close();
    const envelope = parseEnvelope(stored);
    if (envelope) return envelope.state;
  } catch {
    // Fall back to the mirrored browser copy below.
  }
  return loadLegacyEnvelope()?.state ?? null;
}

export async function saveLocalProgress(state: LocalProgressState) {
  const envelope = createEnvelope(state, '自动保存');
  let savedToDatabase = false;
  let savedToMirror = false;

  try {
    const database = await openDatabase();
    const snapshotTransaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const snapshotsComplete = transactionToPromise(snapshotTransaction);
    const snapshots = await requestToPromise(snapshotTransaction.objectStore(SNAPSHOT_STORE).getAll()) as SnapshotRecord[];
    await snapshotsComplete;
    const latestSnapshotTime = snapshots.reduce((latest, snapshot) => (
      Math.max(latest, Date.parse(snapshot.savedAt) || 0)
    ), 0);
    const transaction = database.transaction(PROGRESS_STORE, 'readwrite');
    const complete = transactionToPromise(transaction);
    const store = transaction.objectStore(PROGRESS_STORE);
    store.put(envelope, CURRENT_KEY);
    await complete;
    savedToDatabase = true;

    if (stateHasContent(state) && Date.now() - latestSnapshotTime >= AUTO_SNAPSHOT_INTERVAL) {
      await saveSnapshotToDatabase(database, { ...envelope, label: '自动快照' });
    }
    database.close();
  } catch {
    savedToDatabase = false;
  }

  try {
    saveLegacyMirror(envelope);
    savedToMirror = true;
  } catch {
    savedToMirror = false;
  }

  if (!savedToDatabase && !savedToMirror) {
    throw new Error('无法保存到当前浏览器');
  }
  return envelope.savedAt;
}

export async function createProgressSnapshot(state: LocalProgressState, label: string) {
  const envelope = createEnvelope(state, label);
  let savedToDatabase = false;
  let savedToMirror = false;
  try {
    const database = await openDatabase();
    const progressTransaction = database.transaction(PROGRESS_STORE, 'readwrite');
    const progressComplete = transactionToPromise(progressTransaction);
    progressTransaction.objectStore(PROGRESS_STORE).put(envelope, CURRENT_KEY);
    await progressComplete;
    await saveSnapshotToDatabase(database, envelope);
    database.close();
    savedToDatabase = true;
  } catch {
    savedToDatabase = false;
  }
  try {
    saveLegacyMirror(envelope);
    savedToMirror = true;
  } catch {
    savedToMirror = false;
  }
  if (!savedToDatabase && !savedToMirror) {
    throw new Error('无法创建本地快照');
  }
  return envelope;
}

export async function loadLatestSnapshot() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const complete = transactionToPromise(transaction);
    const records = await requestToPromise(transaction.objectStore(SNAPSHOT_STORE).getAll()) as SnapshotRecord[];
    await complete;
    database.close();
    const latest = records.sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
    if (latest) return latest;
  } catch {
    // Fall back to the mirrored latest backup below.
  }
  const fallback = loadLegacyEnvelope();
  return fallback ? { ...fallback, id: 'local-mirror' } : null;
}

function safeFileTime(isoTime: string) {
  return isoTime.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
}

export function downloadProgressBackup(state: LocalProgressState, label = '手动备份') {
  const envelope = createEnvelope(state, label);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `把才华变成钱_备份_${safeFileTime(envelope.savedAt)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return envelope.savedAt;
}

export async function readProgressBackup(file: File) {
  const raw = await file.text();
  const parsed = JSON.parse(raw) as unknown;
  const envelope = parseEnvelope(parsed);
  if (!envelope) throw new Error('这不是有效的进度备份文件');
  return envelope;
}
