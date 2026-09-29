import {
  type NetworkDevice,
  type NetworkIncident,
  type NetworkConnectionType,
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
import { authService } from './authService';

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
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can add network topology hardware.');
    }

    const id = generateUUID();
    const now = new Date().toISOString();

    const device: NetworkDevice = {
      ...data,
      id,
      uplinkDeviceId: data.predecessorId || data.uplinkDeviceId,
      predecessorId: data.predecessorId || data.uplinkDeviceId,
      successorIds: data.successorIds || [],
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('networkDevices', device);

    // If predecessor is assigned, update predecessor's successor list
    if (device.predecessorId) {
      const parent = await getFromStore<NetworkDevice>('networkDevices', device.predecessorId);
      if (parent) {
        const successors = new Set(parent.successorIds || []);
        successors.add(id);
        const updatedParent: NetworkDevice = {
          ...parent,
          successorIds: Array.from(successors),
          updatedAt: now,
          _syncStatus: 'PENDING_SYNC',
          _syncVersion: (parent._syncVersion || 1) + 1,
        };
        await putToStore('networkDevices', updatedParent);
      }
    }

    // If initial successors are assigned, update their predecessor references
    if (device.successorIds && device.successorIds.length > 0) {
      for (const childId of device.successorIds) {
        const child = await getFromStore<NetworkDevice>('networkDevices', childId);
        if (child) {
          const updatedChild: NetworkDevice = {
            ...child,
            predecessorId: id,
            uplinkDeviceId: id,
            updatedAt: now,
            _syncStatus: 'PENDING_SYNC',
            _syncVersion: (child._syncVersion || 1) + 1,
          };
          await putToStore('networkDevices', updatedChild);
        }
      }
    }

    await auditService.logAction('ADD_NETWORK_DEVICE', 'Network', id, null, {
      deviceName: device.deviceName,
      ipAddress: device.ipAddress,
      deviceType: device.deviceType,
      location: device.location,
      predecessorId: device.predecessorId,
      successorIds: device.successorIds,
    });

    await syncService.enqueueOperation('networkDevices', id, 'CREATE', device);
    return device;
  }

  public async updateDevice(
    id: string,
    updates: Partial<Omit<NetworkDevice, 'id' | 'createdAt' | '_deviceId'>>,
    user: User
  ): Promise<NetworkDevice> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can modify topology nodes.');
    }

    const device = await getFromStore<NetworkDevice>('networkDevices', id);
    if (!device) throw new Error('Device not found');

    const previousData = { ...device };
    const now = new Date().toISOString();

    const normalizedUpdates = {
      ...updates,
      ...(updates.predecessorId !== undefined ? { uplinkDeviceId: updates.predecessorId || undefined } : {}),
      ...(updates.uplinkDeviceId !== undefined && updates.predecessorId === undefined ? { predecessorId: updates.uplinkDeviceId || undefined } : {}),
    };

    const updatedDevice: NetworkDevice = {
      ...device,
      ...normalizedUpdates,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (device._syncVersion || 1) + 1,
    };

    // If predecessor changed, unlink from old predecessor and link to new predecessor
    if (updates.predecessorId !== undefined && updates.predecessorId !== device.predecessorId) {
      if (device.predecessorId) {
        const oldParent = await getFromStore<NetworkDevice>('networkDevices', device.predecessorId);
        if (oldParent && oldParent.successorIds) {
          const updatedOldParent: NetworkDevice = {
            ...oldParent,
            successorIds: oldParent.successorIds.filter((cid) => cid !== id),
            updatedAt: now,
            _syncStatus: 'PENDING_SYNC',
            _syncVersion: (oldParent._syncVersion || 1) + 1,
          };
          await putToStore('networkDevices', updatedOldParent);
        }
      }

      if (updates.predecessorId) {
        const newParent = await getFromStore<NetworkDevice>('networkDevices', updates.predecessorId);
        if (newParent) {
          const currentSuccessors = new Set(newParent.successorIds || []);
          currentSuccessors.add(id);
          const updatedNewParent: NetworkDevice = {
            ...newParent,
            successorIds: Array.from(currentSuccessors),
            updatedAt: now,
            _syncStatus: 'PENDING_SYNC',
            _syncVersion: (newParent._syncVersion || 1) + 1,
          };
          await putToStore('networkDevices', updatedNewParent);
        }
      }
    }

    // If successorIds changed, update child predecessors
    if (updates.successorIds !== undefined) {
      const oldSuccessors = new Set(device.successorIds || []);
      const newSuccessors = new Set(updates.successorIds || []);

      // Unlinked successors
      for (const oldChildId of oldSuccessors) {
        if (!newSuccessors.has(oldChildId)) {
          const child = await getFromStore<NetworkDevice>('networkDevices', oldChildId);
          if (child && child.predecessorId === id) {
            const updatedChild: NetworkDevice = {
              ...child,
              predecessorId: undefined,
              uplinkDeviceId: undefined,
              updatedAt: now,
              _syncStatus: 'PENDING_SYNC',
              _syncVersion: (child._syncVersion || 1) + 1,
            };
            await putToStore('networkDevices', updatedChild);
          }
        }
      }

      // Newly linked successors
      for (const newChildId of newSuccessors) {
        if (!oldSuccessors.has(newChildId)) {
          const child = await getFromStore<NetworkDevice>('networkDevices', newChildId);
          if (child) {
            const updatedChild: NetworkDevice = {
              ...child,
              predecessorId: id,
              uplinkDeviceId: id,
              updatedAt: now,
              _syncStatus: 'PENDING_SYNC',
              _syncVersion: (child._syncVersion || 1) + 1,
            };
            await putToStore('networkDevices', updatedChild);
          }
        }
      }
    }

    await putToStore('networkDevices', updatedDevice);
    await auditService.logAction('UPDATE_NETWORK_DEVICE', 'Network', id, previousData, updates);
    await syncService.enqueueOperation('networkDevices', id, 'UPDATE', updatedDevice);
    return updatedDevice;
  }

  public async connectNodes(
    predecessorId: string,
    successorId: string,
    user: User,
    connectionType?: NetworkConnectionType,
    portSpeed?: string
  ): Promise<{ predecessor: NetworkDevice; successor: NetworkDevice }> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can connect topology nodes.');
    }

    const parent = await getFromStore<NetworkDevice>('networkDevices', predecessorId);
    const child = await getFromStore<NetworkDevice>('networkDevices', successorId);
    if (!parent || !child) throw new Error('One or both network devices not found');

    const now = new Date().toISOString();

    const parentSuccessors = new Set(parent.successorIds || []);
    parentSuccessors.add(successorId);

    const updatedParent: NetworkDevice = {
      ...parent,
      successorIds: Array.from(parentSuccessors),
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (parent._syncVersion || 1) + 1,
    };

    const updatedChild: NetworkDevice = {
      ...child,
      predecessorId,
      uplinkDeviceId: predecessorId,
      connectionType: connectionType || child.connectionType || parent.connectionType || 'Ethernet Cat6',
      portSpeed: portSpeed || child.portSpeed || parent.portSpeed || '1 Gbps',
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (child._syncVersion || 1) + 1,
    };

    await putToStore('networkDevices', updatedParent);
    await putToStore('networkDevices', updatedChild);

    await auditService.logAction('CONNECT_NETWORK_NODES', 'Network', `${predecessorId}->${successorId}`, null, {
      predecessor: parent.deviceName,
      successor: child.deviceName,
      connectionType: updatedChild.connectionType,
    });

    await syncService.enqueueOperation('networkDevices', parent.id, 'UPDATE', updatedParent);
    await syncService.enqueueOperation('networkDevices', child.id, 'UPDATE', updatedChild);

    return { predecessor: updatedParent, successor: updatedChild };
  }

  public async disconnectNodes(
    predecessorId: string,
    successorId: string,
    user: User
  ): Promise<void> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can disconnect topology nodes.');
    }

    const parent = await getFromStore<NetworkDevice>('networkDevices', predecessorId);
    const child = await getFromStore<NetworkDevice>('networkDevices', successorId);
    const now = new Date().toISOString();

    if (parent && parent.successorIds) {
      const updatedParent: NetworkDevice = {
        ...parent,
        successorIds: parent.successorIds.filter((id) => id !== successorId),
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: (parent._syncVersion || 1) + 1,
      };
      await putToStore('networkDevices', updatedParent);
      await syncService.enqueueOperation('networkDevices', parent.id, 'UPDATE', updatedParent);
    }

    if (child && child.predecessorId === predecessorId) {
      const updatedChild: NetworkDevice = {
        ...child,
        predecessorId: undefined,
        uplinkDeviceId: undefined,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: (child._syncVersion || 1) + 1,
      };
      await putToStore('networkDevices', updatedChild);
      await syncService.enqueueOperation('networkDevices', child.id, 'UPDATE', updatedChild);
    }

    await auditService.logAction('DISCONNECT_NETWORK_NODES', 'Network', `${predecessorId}->${successorId}`, null, {
      predecessorId,
      successorId,
    });
  }

  public async deleteDevice(id: string, user: User): Promise<void> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can delete topology nodes.');
    }

    const device = await getFromStore<NetworkDevice>('networkDevices', id);
    if (!device) throw new Error('Device not found');

    const now = new Date().toISOString();

    // Clean up predecessor's successor list
    if (device.predecessorId) {
      const parent = await getFromStore<NetworkDevice>('networkDevices', device.predecessorId);
      if (parent && parent.successorIds) {
        const updatedParent: NetworkDevice = {
          ...parent,
          successorIds: parent.successorIds.filter((cid) => cid !== id),
          updatedAt: now,
          _syncStatus: 'PENDING_SYNC',
          _syncVersion: (parent._syncVersion || 1) + 1,
        };
        await putToStore('networkDevices', updatedParent);
      }
    }

    // Clean up successors' predecessor field
    if (device.successorIds) {
      for (const childId of device.successorIds) {
        const child = await getFromStore<NetworkDevice>('networkDevices', childId);
        if (child && child.predecessorId === id) {
          const updatedChild: NetworkDevice = {
            ...child,
            predecessorId: undefined,
            uplinkDeviceId: undefined,
            updatedAt: now,
            _syncStatus: 'PENDING_SYNC',
            _syncVersion: (child._syncVersion || 1) + 1,
          };
          await putToStore('networkDevices', updatedChild);
        }
      }
    }

    await deleteFromStore('networkDevices', id);
    await auditService.logAction('DELETE_NETWORK_DEVICE', 'Network', id, device, null);
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

  public async cloneDevice(
    sourceDeviceId: string,
    user: User,
    overrides?: Partial<NetworkDevice>
  ): Promise<NetworkDevice> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(user.role) && !authService.isSuperAdminOrIT(user)) {
      throw new Error('Unauthorized: Only Super Administrators and IT Personnel can clone network devices.');
    }

    const source = await getFromStore<NetworkDevice>('networkDevices', sourceDeviceId);
    if (!source) throw new Error('Source device not found for cloning');

    const id = generateUUID();
    const now = new Date().toISOString();

    // Generate unique IP candidate if not provided in overrides
    let targetIp = overrides?.ipAddress;
    if (!targetIp && source.ipAddress) {
      const parts = source.ipAddress.split('.');
      if (parts.length === 4) {
        const lastOctet = parseInt(parts[3], 10);
        if (!isNaN(lastOctet)) {
          parts[3] = String((lastOctet + Math.floor(Math.random() * 20) + 1) % 254 || 120);
          targetIp = parts.join('.');
        }
      }
    }
    if (!targetIp) targetIp = '192.168.1.' + Math.floor(Math.random() * 150 + 50);

    const randomSerial = 'SN-CLONE-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const clonedDevice: NetworkDevice = {
      ...source,
      id,
      deviceName: overrides?.deviceName || `${source.deviceName} (Copy)`,
      ipAddress: targetIp,
      serialNumber: overrides?.serialNumber || randomSerial,
      macAddress: overrides?.macAddress || `00:1B:44:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`,
      status: overrides?.status || 'Online',
      predecessorId: overrides?.predecessorId !== undefined ? overrides.predecessorId : source.predecessorId,
      uplinkDeviceId: overrides?.predecessorId !== undefined ? overrides.predecessorId : source.predecessorId,
      successorIds: overrides?.successorIds || [], // Clones start with clean successors unless specified
      canvasX: overrides?.canvasX !== undefined ? overrides.canvasX : (source.canvasX ? source.canvasX + 40 : undefined),
      canvasY: overrides?.canvasY !== undefined ? overrides.canvasY : (source.canvasY ? source.canvasY + 40 : undefined),
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('networkDevices', clonedDevice);

    // If cloned device has a predecessor, register this clone in the predecessor's successor list
    if (clonedDevice.predecessorId) {
      const parent = await getFromStore<NetworkDevice>('networkDevices', clonedDevice.predecessorId);
      if (parent) {
        const successors = new Set(parent.successorIds || []);
        successors.add(id);
        const updatedParent: NetworkDevice = {
          ...parent,
          successorIds: Array.from(successors),
          updatedAt: now,
          _syncStatus: 'PENDING_SYNC',
          _syncVersion: (parent._syncVersion || 1) + 1,
        };
        await putToStore('networkDevices', updatedParent);
      }
    }

    await auditService.logAction('CLONE_NETWORK_DEVICE', 'Network', id, null, {
      sourceId: source.id,
      sourceName: source.deviceName,
      clonedName: clonedDevice.deviceName,
      ipAddress: clonedDevice.ipAddress,
    });

    await syncService.enqueueOperation('networkDevices', id, 'CREATE', clonedDevice);
    return clonedDevice;
  }

  public async updatePositions(
    positions: { id: string; canvasX: number; canvasY: number }[]
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const pos of positions) {
      const dev = await getFromStore<NetworkDevice>('networkDevices', pos.id);
      if (dev && (dev.canvasX !== pos.canvasX || dev.canvasY !== pos.canvasY)) {
        const updated: NetworkDevice = {
          ...dev,
          canvasX: pos.canvasX,
          canvasY: pos.canvasY,
          updatedAt: now,
          _syncStatus: 'PENDING_SYNC',
          _syncVersion: (dev._syncVersion || 1) + 1,
        };
        await putToStore('networkDevices', updated);
        await syncService.enqueueOperation('networkDevices', pos.id, 'UPDATE', updated);
      }
    }
  }
}

export const networkService = new NetworkService();
