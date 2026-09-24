import { getAllFromStore, type StoreName } from './localDatabaseService';

export interface SeedSnapshotData {
  savedAt: string;
  version: string;
  data: {
    users: any[];
    settings: any[];
    hospitalSystems: any[];
    assets: any[];
    tickets: any[];
    inventory: any[];
    maintenance: any[];
    incidents: any[];
    memos: any[];
    departments: any[];
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
        assets,
        tickets,
        inventory,
        maintenance,
        incidents,
        memos,
        departments,
      ] = await Promise.all([
        getAllFromStore<any>('users'),
        getAllFromStore<any>('settings'),
        getAllFromStore<any>('hospitalSystems'),
        getAllFromStore<any>('assets'),
        getAllFromStore<any>('tickets'),
        getAllFromStore<any>('inventory'),
        getAllFromStore<any>('maintenance'),
        getAllFromStore<any>('incidents'),
        getAllFromStore<any>('memos'),
        getAllFromStore<any>('departments'),
      ]);

      const payload: SeedSnapshotData = {
        savedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          users,
          settings,
          hospitalSystems,
          assets,
          tickets,
          inventory,
          maintenance,
          incidents,
          memos,
          departments,
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
   * Triggers a debounced snapshot to continuously keep defaultSeedData.json synchronized
   */
  public triggerAutoSnapshot(delayMs: number = 2000) {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.snapshotCurrentStateAsDefaultSeed().catch((e) =>
        console.warn('[SeedSnapshotService] Auto snapshot error:', e)
      );
    }, delayMs);
  }

  /**
   * Triggers browser download of current complete seed dataset
   */
  public async downloadCurrentSeedBackup(): Promise<void> {
    const [
      users,
      settings,
      hospitalSystems,
      assets,
      tickets,
      inventory,
      maintenance,
      incidents,
      memos,
      departments,
    ] = await Promise.all([
      getAllFromStore<any>('users'),
      getAllFromStore<any>('settings'),
      getAllFromStore<any>('hospitalSystems'),
      getAllFromStore<any>('assets'),
      getAllFromStore<any>('tickets'),
      getAllFromStore<any>('inventory'),
      getAllFromStore<any>('maintenance'),
      getAllFromStore<any>('incidents'),
      getAllFromStore<any>('memos'),
      getAllFromStore<any>('departments'),
    ]);

    const backupData: SeedSnapshotData = {
      savedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        users,
        settings,
        hospitalSystems,
        assets,
        tickets,
        inventory,
        maintenance,
        incidents,
        memos,
        departments,
      },
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hitoms-default-seed-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const seedSnapshotService = new SeedSnapshotService();
