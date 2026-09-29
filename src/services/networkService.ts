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

    // Consolidate predecessors for multi-uplink support
    const initialPredecessors = new Set<string>();
    if (data.predecessorId) initialPredecessors.add(data.predecessorId);
    if (data.uplinkDeviceId) initialPredecessors.add(data.uplinkDeviceId);
    if (data.predecessorIds && Array.isArray(data.predecessorIds)) {
      data.predecessorIds.forEach((p) => p && initialPredecessors.add(p));
    }
    const predecessorIds = Array.from(initialPredecessors);
    const primaryPredecessorId = predecessorIds[0] || undefined;

    const isSwitchType = [
      'Managed Switch',
      'Core Switch',
      'Distribution Switch',
      'Access Switch',
      'Switch',
    ].includes(data.deviceType);

    const isApType = [
      'Access Point (Indoor)',
      'Access Point (Outdoor)',
      'Access Point',
    ].includes(data.deviceType);

    const device: NetworkDevice = {
      ...data,
      id,
      predecessorId: primaryPredecessorId,
      predecessorIds,
      uplinkDeviceId: primaryPredecessorId,
      uplinkDeviceIds: predecessorIds,
      successorIds: data.successorIds || [],
      isManagedSwitch: data.isManagedSwitch ?? (isSwitchType && data.vlanEnabled),
      vlanEnabled: data.vlanEnabled ?? (data.deviceType === 'Managed Switch' || (data.vlans && data.vlans.length > 0)),
      vlans: data.vlans || (data.vlanEnabled || data.deviceType === 'Managed Switch' ? ['10', '20', '30', '99'] : undefined),
      apCoverageType: data.apCoverageType ?? (data.deviceType === 'Access Point (Outdoor)' ? 'Outdoor' : isApType ? 'Indoor' : undefined),
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('networkDevices', device);

    // If predecessors are assigned, update all parent devices' successor lists
    for (const parentId of predecessorIds) {
      const parent = await getFromStore<NetworkDevice>('networkDevices', parentId);
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
          const childPreds = new Set(child.predecessorIds || []);
          if (child.predecessorId) childPreds.add(child.predecessorId);
          childPreds.add(id);
          const childPredList = Array.from(childPreds);

          const updatedChild: NetworkDevice = {
            ...child,
            predecessorId: childPredList[0] || id,
            predecessorIds: childPredList,
            uplinkDeviceId: childPredList[0] || id,
            uplinkDeviceIds: childPredList,
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
      predecessorIds: device.predecessorIds,
      vlanEnabled: device.vlanEnabled,
      vlans: device.vlans,
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

    // Reconcile multi-uplink predecessors
    let newPredecessorIds = updates.predecessorIds !== undefined
      ? updates.predecessorIds
      : device.predecessorIds || (device.predecessorId ? [device.predecessorId] : []);

    if (updates.predecessorId !== undefined) {
      if (updates.predecessorId) {
        if (!newPredecessorIds.includes(updates.predecessorId)) {
          newPredecessorIds = [updates.predecessorId, ...newPredecessorIds];
        }
      } else {
        newPredecessorIds = [];
      }
    }

    const primaryPredId = newPredecessorIds[0] || undefined;

    const updatedDevice: NetworkDevice = {
      ...device,
      ...updates,
      predecessorId: primaryPredId,
      predecessorIds: newPredecessorIds,
      uplinkDeviceId: primaryPredId,
      uplinkDeviceIds: newPredecessorIds,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (device._syncVersion || 1) + 1,
    };

    // Calculate diff for predecessors (uplinks)
    const oldPredSet = new Set(device.predecessorIds || (device.predecessorId ? [device.predecessorId] : []));
    const newPredSet = new Set(newPredecessorIds);

    // Removed predecessors: remove device from their successor lists
    for (const oldParentId of oldPredSet) {
      if (!newPredSet.has(oldParentId)) {
        const oldParent = await getFromStore<NetworkDevice>('networkDevices', oldParentId);
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
    }

    // Newly added predecessors: add device to their successor lists
    for (const newParentId of newPredSet) {
      if (!oldPredSet.has(newParentId)) {
        const newParent = await getFromStore<NetworkDevice>('networkDevices', newParentId);
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
          if (child) {
            const childPreds = (child.predecessorIds || (child.predecessorId ? [child.predecessorId] : [])).filter((p) => p !== id);
            const updatedChild: NetworkDevice = {
              ...child,
              predecessorId: childPreds[0] || undefined,
              predecessorIds: childPreds,
              uplinkDeviceId: childPreds[0] || undefined,
              uplinkDeviceIds: childPreds,
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
            const childPreds = new Set(child.predecessorIds || (child.predecessorId ? [child.predecessorId] : []));
            childPreds.add(id);
            const childPredList = Array.from(childPreds);
            const updatedChild: NetworkDevice = {
              ...child,
              predecessorId: childPredList[0] || id,
              predecessorIds: childPredList,
              uplinkDeviceId: childPredList[0] || id,
              uplinkDeviceIds: childPredList,
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

    // For multi-uplink support (Managed Switches, dual homing): add to predecessorIds
    const childPreds = new Set(child.predecessorIds || (child.predecessorId ? [child.predecessorId] : []));
    childPreds.add(predecessorId);
    const childPredList = Array.from(childPreds);

    const updatedChild: NetworkDevice = {
      ...child,
      predecessorId: childPredList[0] || predecessorId,
      predecessorIds: childPredList,
      uplinkDeviceId: childPredList[0] || predecessorId,
      uplinkDeviceIds: childPredList,
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
      portSpeed: updatedChild.portSpeed,
      childTotalUplinks: childPredList.length,
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

    if (child) {
      const childPreds = (child.predecessorIds || (child.predecessorId ? [child.predecessorId] : [])).filter((id) => id !== predecessorId);
      const updatedChild: NetworkDevice = {
        ...child,
        predecessorId: childPreds[0] || undefined,
        predecessorIds: childPreds,
        uplinkDeviceId: childPreds[0] || undefined,
        uplinkDeviceIds: childPreds,
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

    // Clean up all predecessors' successor lists
    const allPredIds = new Set(device.predecessorIds || (device.predecessorId ? [device.predecessorId] : []));
    for (const parentId of allPredIds) {
      const parent = await getFromStore<NetworkDevice>('networkDevices', parentId);
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

    // Clean up successors' predecessor lists
    if (device.successorIds) {
      for (const childId of device.successorIds) {
        const child = await getFromStore<NetworkDevice>('networkDevices', childId);
        if (child) {
          const childPreds = (child.predecessorIds || (child.predecessorId ? [child.predecessorId] : [])).filter((p) => p !== id);
          const updatedChild: NetworkDevice = {
            ...child,
            predecessorId: childPreds[0] || undefined,
            predecessorIds: childPreds,
            uplinkDeviceId: childPreds[0] || undefined,
            uplinkDeviceIds: childPreds,
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
