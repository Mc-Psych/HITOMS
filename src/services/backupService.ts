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
import { downloadJsonFile } from '../utils/fileDownloader';
import { settingsService } from './settingsService';

class BackupService {
  public async getBackups(): Promise<BackupRecord[]> {
    const list = await getAllFromStore<BackupRecord>('backups');
    return list.sort((a, b) => new Date(b.lastBackup || b.createdAt).getTime() - new Date(a.lastBackup || a.createdAt).getTime());
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

  /**
   * Generates a full manual backup snapshot, saves record to IndexedDB, and triggers file download
   */
  public async createManualBackup(
    user: User,
    autoDownload = true
  ): Promise<{ record: BackupRecord; data: Record<string, any>; filename: string }> {
    const data = await exportFullDatabase();
    const jsonStr = JSON.stringify(data, null, 2);
    const sizeKb = (jsonStr.length / 1024).toFixed(1) + ' KB';
    const now = new Date().toISOString();
    const dateFormatted = now.slice(0, 10);
    const timeFormatted = now.slice(11, 19).replace(/:/g, '-');
    const sysSettings = settingsService.getSettingsSync();
    const sysName = sysSettings?.systemName || 'HITOMS';
    const filename = `${sysName}-Hospital-Backup-${dateFormatted}_${timeFormatted}.json`;

    const record: BackupRecord = {
      id: generateUUID(),
      system: `${sysName} Local Hospital Server`,
      backupType: 'Full Database',
      frequency: 'Manual',
      destination: 'Local Hospital Storage / Browser Archive',
      lastBackup: now,
      status: 'Successful',
      size: sizeKb,
      verified: true,
      verificationDate: now,
      performedBy: user.fullName,
      notes: `Full uncompressed JSON snapshot containing all local IndexedDB stores (${filename}).`,
      createdAt: now,
      _syncStatus: 'LOCAL_ONLY',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('backups', record);
    await auditService.logAction('CREATE_LOCAL_BACKUP', 'Backups', record.id, null, {
      size: sizeKb,
      filename,
      performedBy: user.fullName,
    });

    if (autoDownload) {
      downloadJsonFile(filename, data);
    }

    return { record, data, filename };
  }

  /**
   * Direct download of full live database snapshot
   */
  public async downloadFullDatabaseSnapshot(user?: User): Promise<{ success: boolean; filename: string }> {
    const data = await exportFullDatabase();
    const now = new Date().toISOString();
    const dateFormatted = now.slice(0, 10);
    const timeFormatted = now.slice(11, 19).replace(/:/g, '-');
    const sysSettings = settingsService.getSettingsSync();
    const sysName = sysSettings?.systemName || 'HITOMS';
    const filename = `${sysName}-FullDatabase-Snapshot-${dateFormatted}_${timeFormatted}.json`;

    const success = downloadJsonFile(filename, data);

    if (user) {
      await auditService.logAction('EXPORT_DATABASE_SNAPSHOT', 'Backups', 'SNAPSHOT_EXPORT', null, {
        filename,
        performedBy: user.fullName,
      });
    }

    return { success, filename };
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
