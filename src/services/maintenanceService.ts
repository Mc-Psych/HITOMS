import {
  type MaintenanceRecord,
  type MaintenanceStatus,
  type MaintenanceFrequency,
  type ChecklistItem,
  type PartUsed,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  generateUUID,
  getNextMaintenanceNumber,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { syncService } from './syncService';

class MaintenanceService {
  public async getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    const list = await getAllFromStore<MaintenanceRecord>('maintenance');
    return list.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }

  public async getMaintenanceById(id: string): Promise<MaintenanceRecord | null> {
    return getFromStore<MaintenanceRecord>('maintenance', id);
  }

  public async scheduleMaintenance(
    data: {
      assetId: string;
      assetTag: string;
      assetName: string;
      department: string;
      maintenanceType: string;
      frequency: MaintenanceFrequency;
      scheduledDate: string;
      assignedTechnician: string;
      checklist: ChecklistItem[];
    },
    user: User
  ): Promise<MaintenanceRecord> {
    const id = generateUUID();
    const maintenanceNumber = await getNextMaintenanceNumber();
    const now = new Date().toISOString();

    const record: MaintenanceRecord = {
      id,
      maintenanceNumber,
      assetId: data.assetId,
      assetTag: data.assetTag,
      assetName: data.assetName,
      department: data.department,
      maintenanceType: data.maintenanceType,
      frequency: data.frequency,
      scheduledDate: data.scheduledDate,
      assignedTechnician: data.assignedTechnician,
      status: 'Scheduled',
      checklist: data.checklist,
      partsUsed: [],
      cost: 0,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('maintenance', record);

    await auditService.logAction('SCHEDULE_MAINTENANCE', 'Maintenance', id, null, {
      maintenanceNumber,
      assetTag: data.assetTag,
      scheduledDate: data.scheduledDate,
      assignedTechnician: data.assignedTechnician,
    });

    await notificationService.notify(
      `Maintenance Scheduled: ${maintenanceNumber}`,
      `${data.maintenanceType} for ${data.assetTag} scheduled for ${data.scheduledDate}`,
      'info',
      'Maintenance',
      'ALL',
      id
    );

    await syncService.enqueueOperation('maintenance', id, 'CREATE', record);
    return record;
  }

  public async completeMaintenance(
    id: string,
    completionData: {
      findings: string;
      actionsTaken: string;
      partsUsed: PartUsed[];
      checklist: ChecklistItem[];
    },
    user: User
  ): Promise<MaintenanceRecord> {
    const record = await this.getMaintenanceById(id);
    if (!record) throw new Error('Maintenance record not found');

    const now = new Date().toISOString();
    const totalPartsCost = completionData.partsUsed.reduce((sum, p) => sum + p.totalCost, 0);

    // Calculate next scheduled date based on frequency
    let nextDate: Date = new Date(record.scheduledDate);
    if (record.frequency === 'Weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (record.frequency === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (record.frequency === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
    else if (record.frequency === 'Bi-Annual') nextDate.setMonth(nextDate.getMonth() + 6);
    else if (record.frequency === 'Annual') nextDate.setFullYear(nextDate.getFullYear() + 1);

    record.status = 'Completed';
    record.findings = completionData.findings;
    record.actionsTaken = completionData.actionsTaken;
    record.partsUsed = completionData.partsUsed;
    record.checklist = completionData.checklist;
    record.cost = totalPartsCost;
    record.completedAt = now;
    record.completedBy = user.fullName;
    record.nextMaintenanceDate = record.frequency !== 'One-off' ? nextDate.toISOString().split('T')[0] : undefined;
    record.updatedAt = now;
    record._syncStatus = 'PENDING_SYNC';
    record._syncVersion = (record._syncVersion || 1) + 1;

    await putToStore('maintenance', record);

    await auditService.logAction('COMPLETE_MAINTENANCE', 'Maintenance', id, null, {
      maintenanceNumber: record.maintenanceNumber,
      completedBy: user.fullName,
      cost: totalPartsCost,
    });

    await notificationService.notify(
      `Maintenance Completed: ${record.maintenanceNumber}`,
      `${record.maintenanceType} completed on ${record.assetTag} by ${user.fullName}`,
      'success',
      'Maintenance',
      'ALL',
      id
    );

    await syncService.enqueueOperation('maintenance', id, 'UPDATE', record);
    return record;
  }
}

export const maintenanceService = new MaintenanceService();
