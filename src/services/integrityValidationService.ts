import {
  getAllFromStore,
  putToStore,
  putBatchToStore,
  deleteFromStore,
  type StoreName,
  SYNCABLE_STORES,
  setSkipSyncEnqueue,
} from './localDatabaseService';
import { type SyncQueueItem } from '../types';

export interface IntegrityIssue {
  id: string;
  storeName: StoreName | 'syncQueue' | 'system';
  entityId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'MISSING_FIELD' | 'ORPHAN_QUEUE_ITEM' | 'INVALID_TIMESTAMP' | 'REFERENTIAL_DISCREPANCY' | 'SCHEMA_CORRUPTION';
  message: string;
  autoRepairable: boolean;
}

export interface IntegrityReport {
  status: 'HEALTHY' | 'WARNING' | 'CORRUPTED';
  score: number; // 0 to 100
  checkedAt: string;
  totalRecordsChecked: number;
  issuesCount: number;
  issues: IntegrityIssue[];
  autoRepairedCount: number;
  storeCounts: Record<string, number>;
}

type IntegrityListener = (report: IntegrityReport) => void;

class IntegrityValidationService {
  private lastReport: IntegrityReport | null = null;
  private listeners: Set<IntegrityListener> = new Set();
  private validationInterval: any = null;
  private isScanning = false;

  public subscribe(listener: IntegrityListener): () => void {
    this.listeners.add(listener);
    if (this.lastReport) {
      listener(this.lastReport);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.lastReport) {
      this.listeners.forEach((listener) => {
        try {
          listener(this.lastReport!);
        } catch (e) {
          console.warn('[IntegrityValidationService] Listener error:', e);
        }
      });
    }
  }

  public getLastReport(): IntegrityReport | null {
    return this.lastReport;
  }

  /**
   * Starts periodic background validation checks
   */
  public startPeriodicValidation(intervalMs: number = 120000) { // Every 2 minutes
    if (this.validationInterval) return;

    // Run initial scan in background
    setTimeout(() => {
      this.runValidationScan().catch((e) => console.warn('[IntegrityScan] Error on startup scan:', e));
    }, 3000);

    this.validationInterval = setInterval(() => {
      this.runValidationScan().catch((e) => console.warn('[IntegrityScan] Error on periodic scan:', e));
    }, intervalMs);
  }

  public stopPeriodicValidation() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  /**
   * Main validation engine scan checking IndexedDB records against the sync queue
   */
  public async runValidationScan(): Promise<IntegrityReport> {
    if (this.isScanning) {
      if (this.lastReport) return this.lastReport;
    }

    this.isScanning = true;
    const issues: IntegrityIssue[] = [];
    const storeCounts: Record<string, number> = {};
    let totalRecordsChecked = 0;

    try {
      // 1. Fetch data from IndexedDB stores
      const [
        users,
        tickets,
        assets,
        inventory,
        maintenance,
        incidents,
        memos,
        settings,
        networkDevices,
        hospitalSystems,
        departments,
        locations,
        subscriptions,
        queue,
      ] = await Promise.all([
        getAllFromStore<any>('users'),
        getAllFromStore<any>('tickets'),
        getAllFromStore<any>('assets'),
        getAllFromStore<any>('inventory'),
        getAllFromStore<any>('maintenance'),
        getAllFromStore<any>('incidents'),
        getAllFromStore<any>('memos'),
        getAllFromStore<any>('settings'),
        getAllFromStore<any>('networkDevices'),
        getAllFromStore<any>('hospitalSystems'),
        getAllFromStore<any>('departments'),
        getAllFromStore<any>('locations'),
        getAllFromStore<any>('subscriptions'),
        getAllFromStore<SyncQueueItem>('syncQueue'),
      ]);

      storeCounts['users'] = users.length;
      storeCounts['tickets'] = tickets.length;
      storeCounts['assets'] = assets.length;
      storeCounts['inventory'] = inventory.length;
      storeCounts['maintenance'] = maintenance.length;
      storeCounts['incidents'] = incidents.length;
      storeCounts['memos'] = memos.length;
      storeCounts['settings'] = settings.length;
      storeCounts['networkDevices'] = networkDevices.length;
      storeCounts['hospitalSystems'] = hospitalSystems.length;
      storeCounts['departments'] = departments.length;
      storeCounts['locations'] = locations.length;
      storeCounts['subscriptions'] = subscriptions.length;
      storeCounts['syncQueue'] = queue.length;

      totalRecordsChecked =
        users.length +
        tickets.length +
        assets.length +
        inventory.length +
        maintenance.length +
        incidents.length +
        memos.length +
        settings.length +
        networkDevices.length +
        hospitalSystems.length +
        departments.length +
        locations.length +
        subscriptions.length +
        queue.length;

      const userIds = new Set(users.map((u) => u.id));
      const assetIds = new Set(assets.map((a) => a.id));

      // 2. Validate Users Store
      users.forEach((u, index) => {
        if (!u.id) {
          issues.push({
            id: `usr-noid-${index}`,
            storeName: 'users',
            severity: 'HIGH',
            category: 'MISSING_FIELD',
            message: `User record at index ${index} is missing a primary ID key.`,
            autoRepairable: true,
          });
        }
        if (!u.fullName) {
          issues.push({
            id: `usr-noname-${u.id || index}`,
            storeName: 'users',
            entityId: u.id,
            severity: 'MEDIUM',
            category: 'MISSING_FIELD',
            message: `User ${u.id || index} has an empty or missing fullName.`,
            autoRepairable: true,
          });
        }
        if (!u.role) {
          issues.push({
            id: `usr-norole-${u.id || index}`,
            storeName: 'users',
            entityId: u.id,
            severity: 'HIGH',
            category: 'SCHEMA_CORRUPTION',
            message: `User ${u.fullName || u.id} is missing a system role.`,
            autoRepairable: true,
          });
        }
      });

      // 3. Validate Tickets Store & Referential Integrity
      tickets.forEach((t, index) => {
        if (!t.id || !t.ticketNumber) {
          issues.push({
            id: `tkt-corrupt-${index}`,
            storeName: 'tickets',
            entityId: t.id,
            severity: 'HIGH',
            category: 'SCHEMA_CORRUPTION',
            message: `Ticket record at index ${index} lacks ID or Ticket Number.`,
            autoRepairable: true,
          });
        }
        if (t.assetId && !assetIds.has(t.assetId)) {
          issues.push({
            id: `tkt-ref-asset-${t.id}`,
            storeName: 'tickets',
            entityId: t.id,
            severity: 'LOW',
            category: 'REFERENTIAL_DISCREPANCY',
            message: `Ticket ${t.ticketNumber || t.id} references non-existent asset ID (${t.assetId}).`,
            autoRepairable: true,
          });
        }
        if (t.assignedTo && t.assignedTo.uid && !userIds.has(t.assignedTo.uid)) {
          issues.push({
            id: `tkt-ref-user-${t.id}`,
            storeName: 'tickets',
            entityId: t.id,
            severity: 'LOW',
            category: 'REFERENTIAL_DISCREPANCY',
            message: `Ticket ${t.ticketNumber || t.id} is assigned to unknown UID (${t.assignedTo.uid}).`,
            autoRepairable: false,
          });
        }
      });

      // 4. Validate Sync Queue against Local Stores
      const validStoreNames: string[] = SYNCABLE_STORES;
      
      const mapStoreData: Record<string, Map<string, any>> = {
        users: new Map(users.map((item) => [item.id, item])),
        tickets: new Map(tickets.map((item) => [item.id, item])),
        assets: new Map(assets.map((item) => [item.id, item])),
        inventory: new Map(inventory.map((item) => [item.id, item])),
        maintenance: new Map(maintenance.map((item) => [item.id, item])),
        incidents: new Map(incidents.map((item) => [item.id, item])),
        memos: new Map(memos.map((item) => [item.id, item])),
        settings: new Map(settings.map((item) => [item.id, item])),
        networkDevices: new Map(networkDevices.map((item) => [item.id, item])),
        hospitalSystems: new Map(hospitalSystems.map((item) => [item.id, item])),
        departments: new Map(departments.map((item) => [item.id, item])),
        locations: new Map(locations.map((item) => [item.id, item])),
        subscriptions: new Map(subscriptions.map((item) => [item.id, item])),
      };

      queue.forEach((qItem, idx) => {
        if (!qItem.operationId) {
          issues.push({
            id: `q-noid-${idx}`,
            storeName: 'syncQueue',
            severity: 'HIGH',
            category: 'SCHEMA_CORRUPTION',
            message: `Sync Queue item at position ${idx} missing operationId.`,
            autoRepairable: true,
          });
        }
        if (!validStoreNames.includes(qItem.entityType)) {
          issues.push({
            id: `q-invalidstore-${qItem.operationId || idx}`,
            storeName: 'syncQueue',
            entityId: qItem.entityId,
            severity: 'HIGH',
            category: 'SCHEMA_CORRUPTION',
            message: `Queue item targets unknown store type (${qItem.entityType}).`,
            autoRepairable: true,
          });
        }

        // Check for orphan UPDATE operations where entity no longer exists locally
        // (DELETE operations are intentionally for items that do not exist locally, so never flag DELETE as orphan!)
        if (qItem.operation === 'UPDATE' && mapStoreData[qItem.entityType]) {
          const exists = mapStoreData[qItem.entityType].has(qItem.entityId);
          if (!exists) {
            issues.push({
              id: `q-orphan-${qItem.operationId}`,
              storeName: 'syncQueue',
              entityId: qItem.entityId,
              severity: 'MEDIUM',
              category: 'ORPHAN_QUEUE_ITEM',
              message: `Orphan sync mutation queued for deleted ${qItem.entityType} item (${qItem.entityId}).`,
              autoRepairable: true,
            });
          }
        }
      });

      // 5. Calculate Integrity Score & Status
      let penalty = 0;
      issues.forEach((iss) => {
        if (iss.severity === 'HIGH') penalty += 15;
        else if (iss.severity === 'MEDIUM') penalty += 8;
        else penalty += 2;
      });

      const score = Math.max(0, Math.min(100, 100 - penalty));
      let status: 'HEALTHY' | 'WARNING' | 'CORRUPTED' = 'HEALTHY';
      if (score < 80 || issues.some((i) => i.severity === 'HIGH')) {
        status = 'CORRUPTED';
      } else if (issues.length > 0) {
        status = 'WARNING';
      }

      this.lastReport = {
        status,
        score,
        checkedAt: new Date().toISOString(),
        totalRecordsChecked,
        issuesCount: issues.length,
        issues,
        autoRepairedCount: this.lastReport?.autoRepairedCount || 0,
        storeCounts,
      };

      this.notify();
      return this.lastReport;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Automated Data Repair: Fixes missing fields, orphan queue entries, and invalid records
   */
  public async repairCorruptedData(): Promise<{ repairedCount: number; report: IntegrityReport }> {
    if (!this.lastReport || this.lastReport.issues.length === 0) {
      const freshReport = await this.runValidationScan();
      if (freshReport.issues.length === 0) {
        return { repairedCount: 0, report: freshReport };
      }
    }

    setSkipSyncEnqueue(true);
    let repairedCount = 0;

    try {
      const report = this.lastReport!;
      const repairableIssues = report.issues.filter((i) => i.autoRepairable);

      // 1. Remove Orphan or Corrupted Sync Queue Items
      const orphanQueueIds = repairableIssues
        .filter((i) => i.storeName === 'syncQueue' || i.category === 'ORPHAN_QUEUE_ITEM')
        .map((i) => i.entityId || i.id.replace('q-orphan-', '').replace('q-noid-', ''))
        .filter(Boolean);

      if (orphanQueueIds.length > 0) {
        const queue = await getAllFromStore<SyncQueueItem>('syncQueue');
        for (const item of queue) {
          // Never prune legitimate pending DELETE operations
          if (item.operation === 'DELETE') continue;
          if (!item.operationId || orphanQueueIds.includes(item.operationId) || (item.entityId && orphanQueueIds.includes(item.entityId))) {
            await deleteFromStore('syncQueue', item.operationId);
            repairedCount++;
          }
        }
      }

      // 2. Repair Users with missing mandatory fields
      const userIssues = repairableIssues.filter((i) => i.storeName === 'users');
      if (userIssues.length > 0) {
        const users = await getAllFromStore<any>('users');
        for (const u of users) {
          let modified = false;
          if (!u.role) {
            u.role = 'STAFF_USER';
            modified = true;
          }
          if (!u.status) {
            u.status = 'Active';
            modified = true;
          }
          if (!u.fullName) {
            u.fullName = u.username || `Staff User (${u.id.substring(0, 6)})`;
            modified = true;
          }
          if (modified) {
            await putToStore('users', u);
            repairedCount++;
          }
        }
      }

      // 3. Repair Tickets with referential asset issues
      const ticketRefIssues = repairableIssues.filter((i) => i.category === 'REFERENTIAL_DISCREPANCY' && i.storeName === 'tickets');
      if (ticketRefIssues.length > 0) {
        const tickets = await getAllFromStore<any>('tickets');
        for (const t of tickets) {
          if (t.assetId) {
            const assetExists = await getAllFromStore<any>('assets').then((assets) => assets.some((a) => a.id === t.assetId));
            if (!assetExists) {
              t.assetId = null;
              await putToStore('tickets', t);
              repairedCount++;
            }
          }
        }
      }

    } catch (e) {
      console.error('[IntegrityValidationService] Error during auto-repair:', e);
    } finally {
      setSkipSyncEnqueue(false);
    }

    // Re-run scan to update status
    const postRepairReport = await this.runValidationScan();
    postRepairReport.autoRepairedCount = (this.lastReport?.autoRepairedCount || 0) + repairedCount;
    this.lastReport = postRepairReport;
    this.notify();

    return { repairedCount, report: postRepairReport };
  }
}

export const integrityValidationService = new IntegrityValidationService();
