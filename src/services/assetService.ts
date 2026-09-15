import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type AssetHistoryEntry,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  generateUUID,
  getNextAssetTag,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { syncService } from './syncService';

class AssetService {
  public async getAssets(): Promise<Asset[]> {
    const assets = await getAllFromStore<Asset>('assets');
    return assets.sort((a, b) => a.assetTag.localeCompare(b.assetTag));
  }

  public async getAssetById(id: string): Promise<Asset | null> {
    return getFromStore<Asset>('assets', id);
  }

  public async getAssetByTag(tag: string): Promise<Asset | null> {
    const assets = await this.getAssets();
    return assets.find((a) => a.assetTag.toLowerCase() === tag.trim().toLowerCase()) || null;
  }

  public async getAssetHistory(assetId: string): Promise<AssetHistoryEntry[]> {
    const all = await getAllFromStore<AssetHistoryEntry>('assetHistory');
    return all
      .filter((h) => h.assetId === assetId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async createAsset(
    data: Omit<Asset, 'id' | 'assetTag' | 'qrCodeData' | 'createdAt' | 'updatedAt' | '_syncStatus' | '_syncVersion' | '_lastSyncedAt' | '_deviceId'>,
    user: User
  ): Promise<Asset> {
    const id = generateUUID();
    const assetTag = await getNextAssetTag();
    const now = new Date().toISOString();

    const newAsset: Asset = {
      ...data,
      id,
      assetTag,
      qrCodeData: `HITOMS-ASSET:${assetTag}`,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('assets', newAsset);

    // Initial History Entry
    const historyEntry: AssetHistoryEntry = {
      id: generateUUID(),
      assetId: id,
      action: 'Created',
      details: `Asset registered with Tag ${assetTag} (${newAsset.manufacturer} ${newAsset.model}) in ${newAsset.department}`,
      performedBy: user.fullName,
      timestamp: now,
    };
    await putToStore('assetHistory', historyEntry);

    await auditService.logAction('CREATE_ASSET', 'Assets', id, null, {
      assetTag,
      manufacturer: newAsset.manufacturer,
      model: newAsset.model,
      department: newAsset.department,
    });

    await syncService.enqueueOperation('assets', id, 'CREATE', newAsset);
    return newAsset;
  }

  public async updateAsset(
    id: string,
    updates: Partial<Asset>,
    user: User,
    changeReason?: string
  ): Promise<Asset> {
    const asset = await this.getAssetById(id);
    if (!asset) throw new Error('Asset not found');

    const oldAsset = { ...asset };
    const now = new Date().toISOString();

    const updatedAsset: Asset = {
      ...asset,
      ...updates,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (asset._syncVersion || 1) + 1,
    };

    await putToStore('assets', updatedAsset);

    // Track in History if status or assignment or department changed
    if (updates.department && updates.department !== oldAsset.department) {
      const historyEntry: AssetHistoryEntry = {
        id: generateUUID(),
        assetId: id,
        action: 'Transferred',
        details: `Transferred from ${oldAsset.department} to ${updates.department}. ${changeReason || ''}`,
        performedBy: user.fullName,
        timestamp: now,
      };
      await putToStore('assetHistory', historyEntry);
    } else if (updates.assignedUser && updates.assignedUser !== oldAsset.assignedUser) {
      const historyEntry: AssetHistoryEntry = {
        id: generateUUID(),
        assetId: id,
        action: 'Assigned',
        details: `Reassigned from ${oldAsset.assignedUser || 'None'} to ${updates.assignedUser}.`,
        performedBy: user.fullName,
        timestamp: now,
      };
      await putToStore('assetHistory', historyEntry);
    } else if (updates.status && updates.status !== oldAsset.status) {
      const historyEntry: AssetHistoryEntry = {
        id: generateUUID(),
        assetId: id,
        action: 'StatusChanged',
        details: `Status changed from ${oldAsset.status} to ${updates.status}. ${changeReason || ''}`,
        performedBy: user.fullName,
        timestamp: now,
      };
      await putToStore('assetHistory', historyEntry);
    }

    await auditService.logAction('UPDATE_ASSET', 'Assets', id, oldAsset, updatedAsset);
    await syncService.enqueueOperation('assets', id, 'UPDATE', updatedAsset);

    return updatedAsset;
  }
}

export const assetService = new AssetService();
