import {
  type Asset,
  type AssetStatus,
  type AssetCondition,
  type AssetHistoryEntry,
  type SoftwareSubscription,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
  getNextAssetTag,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { syncService } from './syncService';
import {
  generateAssetQrMetadataPayload,
  renderAssetQrJpegDataUrl,
  downloadAssetQrJpeg,
  type QrLabelRenderOptions,
} from '../utils/qrLabelGenerator';

export {
  generateAssetQrMetadataPayload,
  renderAssetQrJpegDataUrl,
  downloadAssetQrJpeg,
  type QrLabelRenderOptions,
};

export const generateRichAssetQrPayload = generateAssetQrMetadataPayload;

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
    const clean = tag.trim().toLowerCase();
    return (
      assets.find(
        (a) =>
          a.assetTag.toLowerCase() === clean ||
          a.assetTag.toLowerCase().includes(clean) ||
          clean.includes(a.assetTag.toLowerCase()) ||
          (a.serialNumber && a.serialNumber.toLowerCase() === clean)
      ) || null
    );
  }

  public async getAssetHistory(assetId: string): Promise<AssetHistoryEntry[]> {
    const all = await getAllFromStore<AssetHistoryEntry>('assetHistory');
    return all
      .filter((h) => h.assetId === assetId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Software Subscriptions & Licenses
  public async getSubscriptions(): Promise<SoftwareSubscription[]> {
    const subs = await getAllFromStore<SoftwareSubscription>('subscriptions');
    return subs.sort((a, b) => a.softwareName.localeCompare(b.softwareName));
  }

  public async getSubscriptionById(id: string): Promise<SoftwareSubscription | null> {
    return getFromStore<SoftwareSubscription>('subscriptions', id);
  }

  public async createSubscription(
    data: Omit<SoftwareSubscription, 'id' | 'subscriptionCode' | 'createdAt' | 'updatedAt' | '_syncStatus' | '_syncVersion' | '_lastSyncedAt' | '_deviceId'>,
    user: User
  ): Promise<SoftwareSubscription> {
    const id = generateUUID();
    const existing = await this.getSubscriptions();
    const count = existing.length + 1;
    const subscriptionCode = `SUB-2026-${String(count).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newSub: SoftwareSubscription = {
      ...data,
      id,
      subscriptionCode,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('subscriptions', newSub);

    await auditService.logAction('CREATE_SUBSCRIPTION', 'Assets', id, null, {
      subscriptionCode,
      softwareName: newSub.softwareName,
      vendor: newSub.vendor,
      category: newSub.category,
      totalSeats: newSub.totalSeats,
    });

    await syncService.enqueueOperation('subscriptions', id, 'CREATE', newSub);
    return newSub;
  }

  public async updateSubscription(
    id: string,
    updates: Partial<SoftwareSubscription>,
    user: User
  ): Promise<SoftwareSubscription> {
    const sub = await this.getSubscriptionById(id);
    if (!sub) throw new Error('Software subscription not found');

    const oldSub = { ...sub };
    const now = new Date().toISOString();

    const updatedSub: SoftwareSubscription = {
      ...sub,
      ...updates,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: (sub._syncVersion || 1) + 1,
    };

    await putToStore('subscriptions', updatedSub);

    await auditService.logAction('UPDATE_SUBSCRIPTION', 'Assets', id, oldSub, updatedSub);
    await syncService.enqueueOperation('subscriptions', id, 'UPDATE', updatedSub);

    return updatedSub;
  }

  public async deleteSubscription(id: string, user: User): Promise<void> {
    const sub = await this.getSubscriptionById(id);
    if (!sub) return;

    await deleteFromStore('subscriptions', id);

    await auditService.logAction('DELETE_SUBSCRIPTION', 'Assets', id, sub, {
      subscriptionCode: sub.subscriptionCode,
      softwareName: sub.softwareName,
      deletedBy: user.fullName,
    });

    await syncService.enqueueOperation('subscriptions', id, 'DELETE', { id });
  }

  public async createAsset(
    data: Omit<Asset, 'id' | 'assetTag' | 'qrCodeData' | 'createdAt' | 'updatedAt' | '_syncStatus' | '_syncVersion' | '_lastSyncedAt' | '_deviceId'> & { customAssetTag?: string },
    user: User
  ): Promise<Asset> {
    const id = generateUUID();
    const assetTag = data.customAssetTag?.trim() || (await getNextAssetTag());
    const now = new Date().toISOString();

    const { customAssetTag, ...restData } = data;

    const partialAsset: Partial<Asset> = {
      ...restData,
      id,
      assetTag,
    };

    const newAsset: Asset = {
      ...restData,
      id,
      assetTag,
      qrCodeData: generateRichAssetQrPayload(partialAsset),
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

  public async bulkCreateAssets(
    items: Array<
      Omit<
        Asset,
        | 'id'
        | 'assetTag'
        | 'qrCodeData'
        | 'createdAt'
        | 'updatedAt'
        | '_syncStatus'
        | '_syncVersion'
        | '_lastSyncedAt'
        | '_deviceId'
      > & { customAssetTag?: string }
    >,
    user: User
  ): Promise<{ created: Asset[]; count: number }> {
    const created: Asset[] = [];
    const existingAssets = await this.getAssets();
    let nextCount = 100 + existingAssets.length;
    const now = new Date().toISOString();

    for (const item of items) {
      nextCount++;
      const id = generateUUID();
      const assetTag = item.customAssetTag?.trim() || `AST-HOSP-${String(nextCount).padStart(5, '0')}`;
      const { customAssetTag, ...rest } = item;

      const partialAsset: Partial<Asset> = {
        ...rest,
        id,
        assetTag,
      };

      const newAsset: Asset = {
        ...rest,
        id,
        assetTag,
        qrCodeData: generateRichAssetQrPayload(partialAsset),
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: 1,
        _lastSyncedAt: null,
        _deviceId: getDeviceId(),
      };

      await putToStore('assets', newAsset);

      const historyEntry: AssetHistoryEntry = {
        id: generateUUID(),
        assetId: id,
        action: 'Created',
        details: `Bulk imported asset with Tag ${assetTag} (${newAsset.manufacturer} ${newAsset.model}) assigned to ${newAsset.department}`,
        performedBy: user.fullName,
        timestamp: now,
      };
      await putToStore('assetHistory', historyEntry);

      await syncService.enqueueOperation('assets', id, 'CREATE', newAsset);
      created.push(newAsset);
    }

    await auditService.logAction('BULK_CREATE_ASSETS', 'Assets', 'BULK_IMPORT', null, {
      totalImported: created.length,
      importedBy: user.fullName,
      tags: created.map((a) => a.assetTag),
    });

    return { created, count: created.length };
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

  public async deleteAsset(id: string, user: User, deleteReason?: string): Promise<void> {
    const asset = await this.getAssetById(id);
    if (!asset) return;

    await deleteFromStore('assets', id);

    await auditService.logAction('DELETE_ASSET', 'Assets', id, asset, {
      assetTag: asset.assetTag,
      model: `${asset.manufacturer} ${asset.model}`,
      department: asset.department,
      deletedBy: user.fullName,
      reason: deleteReason || 'Manual deletion from IT asset register',
    });

    await syncService.enqueueOperation('assets', id, 'DELETE', { id });
  }
}

export const assetService = new AssetService();
