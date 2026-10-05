import { getAllFromStore, type StoreName } from './localDatabaseService';
import { downloadJsonFile } from '../utils/fileDownloader';

export interface SeedSnapshotData {
  savedAt: string;
  version: string;
  data: {
    users: any[];
    settings: any[];
    hospitalSystems: any[];
    networkDevices: any[];
    assets: any[];
    tickets: any[];
    inventory: any[];
    maintenance: any[];
    incidents: any[];
    memos: any[];
    departments: any[];
    locations: any[];
    subscriptions: any[];
    knowledgeBase: any[];
  };
}

class SeedSnapshotService {
  private autoSaveTimer: any = null;
  private isSaving = false;

  /**
   * Reads all current state from IndexedDB stores and writes it to src/data/defaultSeedData.json
   */
  public async snapshotCurrentStateAsDefaultSeed(): Promise<{ success: boolean; stats: Record<string, number> }> {
    if (this.isSaving) return { success: false, stats: {} };
    this.isSaving = true;

    try {
      const [
        users,
        settings,
        hospitalSystems,
        networkDevices,
        assets,
        tickets,
        inventory,
        maintenance,
        incidents,
        memos,
        departments,
        locations,
        subscriptions,
        knowledgeBase,
      ] = await Promise.all([
        getAllFromStore<any>('users'),
        getAllFromStore<any>('settings'),
        getAllFromStore<any>('hospitalSystems'),
        getAllFromStore<any>('networkDevices'),
        getAllFromStore<any>('assets'),
        getAllFromStore<any>('tickets'),
        getAllFromStore<any>('inventory'),
        getAllFromStore<any>('maintenance'),
        getAllFromStore<any>('incidents'),
        getAllFromStore<any>('memos'),
        getAllFromStore<any>('departments'),
        getAllFromStore<any>('locations'),
        getAllFromStore<any>('subscriptions'),
        getAllFromStore<any>('knowledgeBase'),
      ]);

      const payload: SeedSnapshotData = {
        savedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          users,
          settings,
          hospitalSystems,
          networkDevices,
          assets,
          tickets,
          inventory,
          maintenance,
          incidents,
          memos,
          departments,
          locations,
          subscriptions,
          knowledgeBase,
        },
      };

      const res = await fetch('/api/save-seed-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const stats = {
        users: users.length,
        settings: settings.length,
        hospitalSystems: hospitalSystems.length,
        networkDevices: networkDevices.length,
        assets: assets.length,
        tickets: tickets.length,
        inventory: inventory.length,
        maintenance: maintenance.length,
        incidents: incidents.length,
        memos: memos.length,
        departments: departments.length,
      };

      if (!res.ok) {
        console.warn('[SeedSnapshotService] Server returned non-ok status for save-seed-data:', res.status);
      }

      return { success: res.ok, stats };
    } catch (e) {
      console.warn('[SeedSnapshotService] Error taking seed snapshot:', e);
      return { success: false, stats: {} };
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Automatic background seed snapshot writing is disabled to eliminate Vite hot-reload and app flickering
   */
  public triggerAutoSnapshot(_delayMs: number = 2000) {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    // No-op: Only manual seed snapshots requested by Super Admin are executed
  }

  /**
   * Triggers browser download of current complete seed dataset
   */
  public async downloadCurrentSeedBackup(): Promise<void> {
    const [
      users,
      settings,
      hospitalSystems,
      networkDevices,
      assets,
      tickets,
      inventory,
      maintenance,
      incidents,
      memos,
      departments,
      locations,
      subscriptions,
      knowledgeBase,
    ] = await Promise.all([
      getAllFromStore<any>('users'),
      getAllFromStore<any>('settings'),
      getAllFromStore<any>('hospitalSystems'),
      getAllFromStore<any>('networkDevices'),
      getAllFromStore<any>('assets'),
      getAllFromStore<any>('tickets'),
      getAllFromStore<any>('inventory'),
      getAllFromStore<any>('maintenance'),
      getAllFromStore<any>('incidents'),
      getAllFromStore<any>('memos'),
      getAllFromStore<any>('departments'),
      getAllFromStore<any>('locations'),
      getAllFromStore<any>('subscriptions'),
      getAllFromStore<any>('knowledgeBase'),
    ]);

    const backupData: SeedSnapshotData = {
      savedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        users,
        settings,
        hospitalSystems,
        networkDevices,
        assets,
        tickets,
        inventory,
        maintenance,
        incidents,
        memos,
        departments,
        locations,
        subscriptions,
        knowledgeBase,
      },
    };

    const filename = `hitoms-default-seed-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(filename, backupData);
  }
}

export const seedSnapshotService = new SeedSnapshotService();
