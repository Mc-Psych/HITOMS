import { type Department, type User } from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { syncService } from './syncService';

class DepartmentService {
  public async getDepartments(): Promise<Department[]> {
    const list = await getAllFromStore<Department>('departments');
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getDepartmentById(id: string): Promise<Department | null> {
    return getFromStore<Department>('departments', id);
  }

  public async createDepartment(
    data: {
      code: string;
      name: string;
      building: string;
      floor: string;
      headOfDepartment: string;
      phone: string;
      isEmergency: boolean;
    },
    currentUser?: User | null
  ): Promise<Department> {
    const now = new Date().toISOString();
    const newDept: Department = {
      id: `dept-${generateUUID().substring(0, 8)}`,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      building: data.building.trim(),
      floor: data.floor.trim(),
      headOfDepartment: data.headOfDepartment.trim(),
      phone: data.phone.trim(),
      isEmergency: Boolean(data.isEmergency),
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('departments', newDept);

    await auditService.logAction('CREATE_DEPARTMENT', 'Departments', newDept.id, null, {
      code: newDept.code,
      name: newDept.name,
      createdBy: currentUser?.fullName || 'Super Admin',
    });

    await syncService.enqueueOperation('departments', newDept.id, 'CREATE', newDept);
    return newDept;
  }

  public async updateDepartment(
    id: string,
    updates: Partial<Omit<Department, 'id' | 'createdAt' | '_syncStatus' | '_syncVersion' | '_deviceId'>>,
    currentUser?: User | null
  ): Promise<Department> {
    const existing = await this.getDepartmentById(id);
    if (!existing) throw new Error(`Department with ID ${id} not found.`);

    const now = new Date().toISOString();
    const updated: Department = {
      ...existing,
      ...updates,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (existing._syncVersion || 1) + 1,
    };

    await putToStore('departments', updated);

    await auditService.logAction('UPDATE_DEPARTMENT', 'Departments', id, existing, {
      updates,
      updatedBy: currentUser?.fullName || 'Super Admin',
    });

    await syncService.enqueueOperation('departments', id, 'UPDATE', updated);
    return updated;
  }

  public async deleteDepartment(id: string, currentUser?: User | null): Promise<void> {
    const existing = await this.getDepartmentById(id);
    if (!existing) return;

    await deleteFromStore('departments', id);

    await auditService.logAction('DELETE_DEPARTMENT', 'Departments', id, existing, {
      code: existing.code,
      name: existing.name,
      deletedBy: currentUser?.fullName || 'Super Admin',
    });

    await syncService.enqueueOperation('departments', id, 'DELETE', { id, name: existing.name });
  }
}

export const departmentService = new DepartmentService();
