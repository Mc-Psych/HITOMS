import {
  type User,
  type Department,
  type LocationItem,
  type Ticket,
  type Asset,
  type AssetHistoryEntry,
  type MaintenanceRecord,
  type Incident,
  type HospitalSystem,
  type NetworkDevice,
  type NetworkIncident,
  type InventoryItem,
  type InventoryTransaction,
  type ProcurementRequest,
  type BackupRecord,
  type KnowledgeArticle,
  type AppNotification,
  type AuditLog,
  type SyncQueueItem,
  type SyncConflict,
  type SystemSettings,
  type SoftwareSubscription,
  type HospitalMemo,
} from '../types';

const DB_NAME = 'HITOMS_Local_Database_v2';
const DB_VERSION = 3;

let skipSyncEnqueue = false;

export function setSkipSyncEnqueue(skip: boolean) {
  skipSyncEnqueue = skip;
}

export function isSkipSyncEnqueue(): boolean {
  return skipSyncEnqueue;
}

export const STORE_NAMES = {
  users: 'users',
  departments: 'departments',
  locations: 'locations',
  tickets: 'tickets',
  assets: 'assets',
  subscriptions: 'subscriptions',
  assetHistory: 'assetHistory',
  maintenance: 'maintenance',
  incidents: 'incidents',
  hospitalSystems: 'hospitalSystems',
  networkDevices: 'networkDevices',
  networkIncidents: 'networkIncidents',
  inventory: 'inventory',
  inventoryTransactions: 'inventoryTransactions',
  procurementRequests: 'procurementRequests',
  backups: 'backups',
  knowledgeBase: 'knowledgeBase',
  notifications: 'notifications',
  auditLogs: 'auditLogs',
  syncQueue: 'syncQueue',
  syncConflicts: 'syncConflicts',
  settings: 'settings',
  emergencyBroadcasts: 'emergencyBroadcasts',
  memos: 'memos',
} as const;

export type StoreName = keyof typeof STORE_NAMES;

export const SYNCABLE_STORES: StoreName[] = [
  'users',
  'departments',
  'locations',
  'tickets',
  'assets',
  'subscriptions',
  'maintenance',
  'incidents',
  'hospitalSystems',
  'networkDevices',
  'networkIncidents',
  'inventory',
  'inventoryTransactions',
  'procurementRequests',
  'knowledgeBase',
  'settings',
  'emergencyBroadcasts',
  'memos',
];

// Tombstone Management: Prevents deleted items from being resurrected by background cloud sync
export function recordTombstone(storeName: string, id: string): void {
  try {
    const raw = localStorage.getItem('hitoms_tombstones');
    const tombstones: Record<string, number> = raw ? JSON.parse(raw) : {};
    tombstones[`${storeName}:${id}`] = Date.now();
    // Prune tombstones older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const key in tombstones) {
      if (tombstones[key] < thirtyDaysAgo) {
        delete tombstones[key];
      }
    }
    localStorage.setItem('hitoms_tombstones', JSON.stringify(tombstones));
  } catch (e) {
    console.warn('[localDatabaseService] Error recording tombstone:', e);
  }
}

export function isTombstone(storeName: string, id: string, remoteUpdatedAt?: string): boolean {
  try {
    const raw = localStorage.getItem('hitoms_tombstones');
    if (!raw) return false;
    const tombstones: Record<string, number> = JSON.parse(raw);
    const deletedAt = tombstones[`${storeName}:${id}`];
    if (!deletedAt) return false;

    // If remote doc was explicitly updated AFTER local deletion (with 5s buffer), it's a newer recreation
    if (remoteUpdatedAt) {
      const remoteTime = new Date(remoteUpdatedAt).getTime();
      if (!isNaN(remoteTime) && remoteTime > deletedAt + 5000) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function clearTombstone(storeName: string, id: string): void {
  try {
    const raw = localStorage.getItem('hitoms_tombstones');
    if (!raw) return;
    const tombstones: Record<string, number> = JSON.parse(raw);
    delete tombstones[`${storeName}:${id}`];
    localStorage.setItem('hitoms_tombstones', JSON.stringify(tombstones));
  } catch (e) {
    // ignore
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

// Unique Device ID generation
export function getDeviceId(): string {
  let devId = localStorage.getItem('hitoms_device_id');
  if (!devId) {
    devId = 'DEV-HOSP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem('hitoms_device_id', devId);
  }
  return devId;
}

// Generate collision-resistant UUID
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'hit-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// Open or initialize IndexedDB
export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORE_NAMES.users)) {
          const s = db.createObjectStore(STORE_NAMES.users, { keyPath: 'id' });
          s.createIndex('email', 'email', { unique: true });
          s.createIndex('role', 'role', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.departments)) {
          db.createObjectStore(STORE_NAMES.departments, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.locations)) {
          db.createObjectStore(STORE_NAMES.locations, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.tickets)) {
          const s = db.createObjectStore(STORE_NAMES.tickets, { keyPath: 'id' });
          s.createIndex('ticketNumber', 'ticketNumber', { unique: true });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('department', 'department', { unique: false });
          s.createIndex('priority', 'priority', { unique: false });
          s.createIndex('assignedToUid', 'assignedTo.uid', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.assets)) {
          const s = db.createObjectStore(STORE_NAMES.assets, { keyPath: 'id' });
          s.createIndex('assetTag', 'assetTag', { unique: true });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('department', 'department', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.subscriptions)) {
          const s = db.createObjectStore(STORE_NAMES.subscriptions, { keyPath: 'id' });
          s.createIndex('subscriptionCode', 'subscriptionCode', { unique: true });
          s.createIndex('category', 'category', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.assetHistory)) {
          const s = db.createObjectStore(STORE_NAMES.assetHistory, { keyPath: 'id' });
          s.createIndex('assetId', 'assetId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.maintenance)) {
          const s = db.createObjectStore(STORE_NAMES.maintenance, { keyPath: 'id' });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('scheduledDate', 'scheduledDate', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.incidents)) {
          const s = db.createObjectStore(STORE_NAMES.incidents, { keyPath: 'id' });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('severity', 'severity', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.hospitalSystems)) {
          db.createObjectStore(STORE_NAMES.hospitalSystems, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.networkDevices)) {
          const s = db.createObjectStore(STORE_NAMES.networkDevices, { keyPath: 'id' });
          s.createIndex('ipAddress', 'ipAddress', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.networkIncidents)) {
          db.createObjectStore(STORE_NAMES.networkIncidents, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.inventory)) {
          const s = db.createObjectStore(STORE_NAMES.inventory, { keyPath: 'id' });
          s.createIndex('itemCode', 'itemCode', { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.inventoryTransactions)) {
          const s = db.createObjectStore(STORE_NAMES.inventoryTransactions, { keyPath: 'id' });
          s.createIndex('itemId', 'itemId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.procurementRequests)) {
          db.createObjectStore(STORE_NAMES.procurementRequests, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.backups)) {
          db.createObjectStore(STORE_NAMES.backups, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.knowledgeBase)) {
          db.createObjectStore(STORE_NAMES.knowledgeBase, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.notifications)) {
          const s = db.createObjectStore(STORE_NAMES.notifications, { keyPath: 'id' });
          s.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.auditLogs)) {
          const s = db.createObjectStore(STORE_NAMES.auditLogs, { keyPath: 'id' });
          s.createIndex('timestamp', 'timestamp', { unique: false });
          s.createIndex('module', 'module', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.syncQueue)) {
          const s = db.createObjectStore(STORE_NAMES.syncQueue, { keyPath: 'operationId' });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.syncConflicts)) {
          db.createObjectStore(STORE_NAMES.syncConflicts, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.settings)) {
          db.createObjectStore(STORE_NAMES.settings, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.emergencyBroadcasts)) {
          const s = db.createObjectStore(STORE_NAMES.emergencyBroadcasts, { keyPath: 'id' });
          s.createIndex('codeType', 'codeType', { unique: false });
          s.createIndex('severity', 'severity', { unique: false });
          s.createIndex('isActive', 'isActive', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.memos)) {
          const s = db.createObjectStore(STORE_NAMES.memos, { keyPath: 'id' });
          s.createIndex('memoNumber', 'memoNumber', { unique: true });
          s.createIndex('memoType', 'memoType', { unique: false });
          s.createIndex('status', 'status', { unique: false });
          s.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }
  return dbPromise;
}

// Generic CRUD operations
export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    console.warn(`[localDatabaseService] Object store '${storeName}' does not exist.`);
    return [];
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getFromStore<T>(storeName: StoreName, key: string): Promise<T | null> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    console.warn(`[localDatabaseService] Object store '${storeName}' does not exist.`);
    return null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function putToStore<T extends { id?: string; operationId?: string; _syncStatus?: string }>(
  storeName: StoreName,
  value: T
): Promise<T> {
  if (value && value.id) {
    clearTombstone(storeName, value.id);
  }
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    console.warn(`[localDatabaseService] Object store '${storeName}' does not exist. Ignoring put.`);
    return value;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => {
      // Automatic real-time Sync Enqueue
      if (
        !skipSyncEnqueue &&
        value._syncStatus !== 'SYNCED' &&
        SYNCABLE_STORES.includes(storeName)
      ) {
        import('./syncService').then(({ syncService }) => {
          syncService.enqueueOperation(
            storeName,
            value.id || '',
            'UPDATE',
            value
          ).catch((e) => console.warn('[localDatabaseService] Async sync failed:', e));
        });
        import('./seedSnapshotService').then(({ seedSnapshotService }) => {
          seedSnapshotService.triggerAutoSnapshot();
        });
      }
      resolve(value);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function putBatchToStore<T extends { id?: string; operationId?: string; _syncStatus?: string }>(
  storeName: StoreName,
  values: T[]
): Promise<void> {
  for (const item of values) {
    if (item && item.id) {
      clearTombstone(storeName, item.id);
    }
  }
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    console.warn(`[localDatabaseService] Object store '${storeName}' does not exist. Ignoring putBatch.`);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of values) {
      store.put(item);
    }
    tx.oncomplete = () => {
      // Automatic real-time Sync Enqueue for Batch
      if (
        !skipSyncEnqueue &&
        SYNCABLE_STORES.includes(storeName)
      ) {
        import('./syncService').then(({ syncService }) => {
          for (const item of values) {
            if (item && item.id && item._syncStatus !== 'SYNCED') {
              syncService.enqueueOperation(
                storeName,
                item.id,
                'UPDATE',
                item
              ).catch((e) => console.warn('[localDatabaseService] Batch async sync failed:', e));
            }
          }
        });
        import('./seedSnapshotService').then(({ seedSnapshotService }) => {
          seedSnapshotService.triggerAutoSnapshot();
        });
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFromStore(storeName: StoreName, key: string): Promise<void> {
  recordTombstone(storeName, key);
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    console.warn(`[localDatabaseService] Object store '${storeName}' does not exist. Ignoring delete.`);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => {
      // Automatic real-time Sync Enqueue for Deletes
      if (
        !skipSyncEnqueue &&
        SYNCABLE_STORES.includes(storeName)
      ) {
        import('./syncService').then(({ syncService }) => {
          syncService.enqueueOperation(
            storeName,
            key,
            'DELETE',
            { id: key }
          ).catch((e) => console.warn('[localDatabaseService] Sync delete failed:', e));
        });
        import('./seedSnapshotService').then(({ seedSnapshotService }) => {
          seedSnapshotService.triggerAutoSnapshot();
        });
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function countStore(storeName: StoreName): Promise<number> {
  const db = await getDB();
  if (!db.objectStoreNames.contains(storeName)) {
    return 0;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Next Sequential Ticket Number Generator (e.g. HIT-2026-000001)
export async function getNextTicketNumber(): Promise<string> {
  const tickets = await getAllFromStore<Ticket>('tickets');
  const existingNumbers = new Set(tickets.map((t) => t.ticketNumber).filter(Boolean));
  const year = new Date().getFullYear();
  const prefix = `HIT-${year}-`;

  let maxSeq = 0;
  for (const t of tickets) {
    if (t.ticketNumber && t.ticketNumber.startsWith(prefix)) {
      const seqStr = t.ticketNumber.replace(prefix, '');
      const num = parseInt(seqStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = Math.max(maxSeq + 1, tickets.length + 1);
  let candidate = `${prefix}${nextSeq.toString().padStart(6, '0')}`;
  while (existingNumbers.has(candidate)) {
    nextSeq++;
    candidate = `${prefix}${nextSeq.toString().padStart(6, '0')}`;
  }

  return candidate;
}

// Next Maintenance Number (e.g. MN-2026-001)
export async function getNextMaintenanceNumber(): Promise<string> {
  const list = await getAllFromStore<MaintenanceRecord>('maintenance');
  const existingNumbers = new Set(list.map((m) => m.maintenanceNumber).filter(Boolean));
  const year = new Date().getFullYear();
  const prefix = `MN-${year}-`;

  let maxSeq = 0;
  for (const m of list) {
    if (m.maintenanceNumber && m.maintenanceNumber.startsWith(prefix)) {
      const seqStr = m.maintenanceNumber.replace(prefix, '');
      const num = parseInt(seqStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = Math.max(maxSeq + 1, list.length + 1);
  let candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  while (existingNumbers.has(candidate)) {
    nextSeq++;
    candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  }

  return candidate;
}

// Next Incident Number (e.g. INC-2026-001)
export async function getNextIncidentNumber(): Promise<string> {
  const list = await getAllFromStore<Incident>('incidents');
  const existingNumbers = new Set(list.map((i) => i.incidentNumber).filter(Boolean));
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;

  let maxSeq = 0;
  for (const i of list) {
    if (i.incidentNumber && i.incidentNumber.startsWith(prefix)) {
      const seqStr = i.incidentNumber.replace(prefix, '');
      const num = parseInt(seqStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = Math.max(maxSeq + 1, list.length + 1);
  let candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  while (existingNumbers.has(candidate)) {
    nextSeq++;
    candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  }

  return candidate;
}

// Next Procurement Request Number (e.g. PR-2026-001)
export async function getNextProcurementNumber(): Promise<string> {
  const list = await getAllFromStore<ProcurementRequest>('procurementRequests');
  const existingNumbers = new Set(list.map((p) => p.requestNumber).filter(Boolean));
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  let maxSeq = 0;
  for (const p of list) {
    if (p.requestNumber && p.requestNumber.startsWith(prefix)) {
      const seqStr = p.requestNumber.replace(prefix, '');
      const num = parseInt(seqStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = Math.max(maxSeq + 1, list.length + 1);
  let candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  while (existingNumbers.has(candidate)) {
    nextSeq++;
    candidate = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  }

  return candidate;
}

// Next Asset Tag (e.g. AST-SMTCHIT-00105 or configured prefix)
export async function getNextAssetTag(configuredPrefix?: string): Promise<string> {
  let prefix = configuredPrefix?.trim();
  if (!prefix) {
    try {
      const storedSettings = await getFromStore<SystemSettings>('settings', 'main');
      prefix = storedSettings?.assetTagPrefix?.trim() || 'AST-SMTCHIT-';
    } catch {
      prefix = 'AST-SMTCHIT-';
    }
  }

  if (prefix && !prefix.endsWith('-') && !prefix.endsWith('_')) {
    prefix = `${prefix}-`;
  }

  const assets = await getAllFromStore<Asset>('assets');
  const existingTags = new Set(assets.map((a) => a.assetTag).filter(Boolean));
  let count = 100 + assets.length + 1;
  let candidate = `${prefix}${String(count).padStart(5, '0')}`;
  while (existingTags.has(candidate)) {
    count++;
    candidate = `${prefix}${String(count).padStart(5, '0')}`;
  }
  return candidate;
}

// Next Inventory Code (e.g. INV-025)
export async function getNextInventoryCode(): Promise<string> {
  const items = await getAllFromStore<InventoryItem>('inventory');
  const existingCodes = new Set(items.map((i) => i.itemCode).filter(Boolean));
  let count = items.length + 1;
  let candidate = `INV-${count.toString().padStart(3, '0')}`;
  while (existingCodes.has(candidate)) {
    count++;
    candidate = `INV-${count.toString().padStart(3, '0')}`;
  }
  return candidate;
}

// Next KB Article ID (e.g. KB-010)
export async function getNextKnowledgeId(): Promise<string> {
  const items = await getAllFromStore<KnowledgeArticle>('knowledgeBase');
  const count = items.length + 1;
  return `KB-${count.toString().padStart(3, '0')}`;
}

// Full Database Export for Local Backups
export async function exportFullDatabase(): Promise<Record<string, any>> {
  const backupData: Record<string, any> = {
    _meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      system: 'HITOMS Local Hospital Server',
      deviceId: getDeviceId(),
    },
  };

  for (const key of Object.keys(STORE_NAMES) as StoreName[]) {
    backupData[key] = await getAllFromStore(key);
  }

  return backupData;
}

// Restore Full Database from JSON Snapshot
export async function restoreFullDatabase(snapshot: Record<string, any>): Promise<{ success: boolean; count: number }> {
  let restoredItems = 0;
  for (const key of Object.keys(STORE_NAMES) as StoreName[]) {
    if (Array.isArray(snapshot[key])) {
      await putBatchToStore(key, snapshot[key]);
      restoredItems += snapshot[key].length;
    }
  }
  return { success: true, count: restoredItems };
}
