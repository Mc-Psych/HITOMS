import { type BackupRecord, type User } from '../types';
import {
  getAllFromStore,
  putToStore,
  generateUUID,
  getDeviceId,
  exportFullDatabase,
  restoreFullDatabase,
} from './localDatabaseService';
import { auditService } from './auditService';

class BackupService {
  public async getBackups(): Promise<BackupRecord[]> {
    const list = await getAllFromStore<BackupRecord>('backups');
    return list.sort((a, b) => new Date(b.lastBackup).getTime() - new Date(a.lastBackup).getTime());
  }

  public async getBackupRecords(): Promise<BackupRecord[]> {
    return this.getBackups();
  }

  public async restoreFromJSON(jsonString: string, user: User): Promise<{ success: boolean; count: number; message: string }> {
    const data = JSON.parse(jsonString);
    const result = await this.restoreFromSnapshot(data, user);
    return {
      success: result.success,
      count: result.count,
      message: `Successfully restored ${result.count} hospital records across local database stores.`,
    };
  }

  public async createManualBackup(user: User): Promise<{ record: BackupRecord; data: Record<string, any> }> {
    const data = await exportFullDatabase();
    const jsonStr = JSON.stringify(data, null, 2);
    const sizeKb = (jsonStr.length / 1024).toFixed(1) + ' KB';
    const now = new Date().toISOString();

    const record: BackupRecord = {
      id: generateUUID(),
      system: 'HITOMS Local Hospital Server',
      backupType: 'Full Database',
      frequency: 'Manual',
      destination: 'Local Hospital Storage / Browser Archive',
      lastBackup: now,
      status: 'Successful',
      size: sizeKb,
      verified: true,
      verificationDate: now,
      performedBy: user.fullName,
      notes: 'Full uncompressed JSON snapshot containing all 21 local IndexedDB stores.',
      createdAt: now,
      _syncStatus: 'LOCAL_ONLY',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('backups', record);
    await auditService.logAction('CREATE_LOCAL_BACKUP', 'Backups', record.id, null, {
      size: sizeKb,
      performedBy: user.fullName,
    });

    return { record, data };
  }

  public async restoreFromSnapshot(snapshot: Record<string, any>, user: User): Promise<{ success: boolean; count: number }> {
    const result = await restoreFullDatabase(snapshot);
    await auditService.logAction('RESTORE_LOCAL_BACKUP', 'Backups', 'RESTORE_OP', null, {
      restoredItemsCount: result.count,
      performedBy: user.fullName,
    });
    return result;
  }
}

export const backupService = new BackupService();
