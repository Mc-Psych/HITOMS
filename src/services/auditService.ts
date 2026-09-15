import { type AuditLog, type Role } from '../types';
import {
  getAllFromStore,
  putToStore,
  generateUUID,
  getDeviceId,
} from './localDatabaseService';
import { authService } from './authService';
import { syncService } from './syncService';

class AuditService {
  public async logAction(
    action: string,
    module: string,
    recordId: string,
    oldValue: any = null,
    newValue: any = null
  ): Promise<void> {
    const user = authService.getCurrentUser();
    const currentDeviceId = getDeviceId();
    const log: AuditLog = {
      id: generateUUID(),
      user: user ? user.fullName : 'Hospital System',
      userName: user ? user.fullName : 'Hospital System',
      userEmail: user ? user.email : 'system@hospital.local',
      userRole: (user ? user.role : 'SUPER_ADMIN') as Role,
      action,
      module,
      entityName: module,
      recordId,
      entityId: recordId,
      oldValue,
      oldValues: oldValue,
      newValue,
      newValues: newValue,
      timestamp: new Date().toISOString(),
      ipOrDevice: currentDeviceId + ' (Hospital LAN)',
      deviceId: currentDeviceId,
      isOfflineAction: true,
    };

    await putToStore('auditLogs', log);
    // Enqueue audit log for cloud sync
    await syncService.enqueueOperation('auditLogs', log.id, 'CREATE', log);
  }

  public async getLogs(): Promise<AuditLog[]> {
    const logs = await getAllFromStore<AuditLog>('auditLogs');
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async getAuditLogs(): Promise<AuditLog[]> {
    return this.getLogs();
  }
}

export const auditService = new AuditService();
