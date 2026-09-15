import {
  type NetworkDevice,
  type NetworkIncident,
  type User,
} from '../types';
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

class NetworkService {
  public async getDevices(): Promise<NetworkDevice[]> {
    const devices = await getAllFromStore<NetworkDevice>('networkDevices');
    return devices.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
  }

  public async getNetworkIncidents(): Promise<NetworkIncident[]> {
    const incidents = await getAllFromStore<NetworkIncident>('networkIncidents');
    return incidents.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  public async addDevice(
    data: Omit<NetworkDevice, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus' | '_syncVersion' | '_lastSyncedAt' | '_deviceId'>,
    user: User
  ): Promise<NetworkDevice> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Administrators can add network topology hardware.');
    }

    const id = generateUUID();
    const now = new Date().toISOString();

    const device: NetworkDevice = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('networkDevices', device);
    await auditService.logAction('ADD_NETWORK_DEVICE', 'Network', id, null, {
      deviceName: device.deviceName,
      ipAddress: device.ipAddress,
      deviceType: device.deviceType,
      location: device.location,
    });

    await syncService.enqueueOperation('networkDevices', id, 'CREATE', device);
    return device;
  }

  public async updateDevice(
    id: string,
    updates: Partial<Omit<NetworkDevice, 'id' | 'createdAt' | '_deviceId'>>,
    user: User
  ): Promise<NetworkDevice> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Administrators can modify topology nodes.');
    }

    const device = await getFromStore<NetworkDevice>('networkDevices', id);
    if (!device) throw new Error('Device not found');

    const previousData = { ...device };
    const updatedDevice: NetworkDevice = {
      ...device,
      ...updates,
      updatedAt: new Date().toISOString(),
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (device._syncVersion || 1) + 1,
    };

    await putToStore('networkDevices', updatedDevice);
    await auditService.logAction('UPDATE_NETWORK_DEVICE', 'Network', id, previousData, updates);
    await syncService.enqueueOperation('networkDevices', id, 'UPDATE', updatedDevice);
    return updatedDevice;
  }

  public async deleteDevice(id: string, user: User): Promise<void> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Administrators can delete topology nodes.');
    }

    const device = await getFromStore<NetworkDevice>('networkDevices', id);
    if (!device) throw new Error('Device not found');

    await deleteFromStore('networkDevices', id);
    await auditService.logAction('DELETE_NETWORK_DEVICE', 'Network', id, device, null);
    await syncService.enqueueOperation('networkDevices', id, 'DELETE', { id, deviceName: device.deviceName });
  }

  public async updateDeviceStatus(
    id: string,
    status: 'Online' | 'Offline' | 'Warning',
    user: User
  ): Promise<NetworkDevice> {
    const device = await getFromStore<NetworkDevice>('networkDevices', id);
    if (!device) throw new Error('Device not found');

    const oldStatus = device.status;
    device.status = status;
    device.updatedAt = new Date().toISOString();
    device._syncStatus = 'PENDING_SYNC';
    device._syncVersion = (device._syncVersion || 1) + 1;

    await putToStore('networkDevices', device);
    await auditService.logAction('UPDATE_DEVICE_STATUS', 'Network', id, { status: oldStatus }, { status });
    await syncService.enqueueOperation('networkDevices', id, 'UPDATE', device);
    return device;
  }

  public async recordNetworkIncident(
    data: {
      deviceId: string;
      deviceName: string;
      type: string;
      cause: string;
      actionTaken: string;
      downtimeMinutes: number;
      resolution?: string;
    },
    user: User
  ): Promise<NetworkIncident> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const incident: NetworkIncident = {
      id,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      type: data.type,
      startTime: now,
      cause: data.cause,
      actionTaken: data.actionTaken,
      technician: user.fullName,
      resolution: data.resolution,
      downtimeMinutes: data.downtimeMinutes,
      createdAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('networkIncidents', incident);
    await auditService.logAction('RECORD_NETWORK_INCIDENT', 'Network', id, null, incident);
    await syncService.enqueueOperation('networkIncidents', id, 'CREATE', incident);
    return incident;
  }
}

export const networkService = new NetworkService();
