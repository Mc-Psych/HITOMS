import {
  type InventoryItem,
  type InventoryTransaction,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  generateUUID,
  getNextInventoryCode,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { syncService } from './syncService';

class InventoryService {
  public async getInventory(): Promise<InventoryItem[]> {
    const items = await getAllFromStore<InventoryItem>('inventory');
    return items.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  public async getItems(): Promise<InventoryItem[]> {
    return this.getInventory();
  }

  public async getTransactions(): Promise<InventoryTransaction[]> {
    const list = await getAllFromStore<InventoryTransaction>('inventoryTransactions');
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public async getItemById(id: string): Promise<InventoryItem | null> {
    return getFromStore<InventoryItem>('inventory', id);
  }

  public async createItem(
    data: Omit<InventoryItem, 'id' | 'itemCode' | 'createdAt' | 'lastUpdated' | '_syncStatus' | '_syncVersion' | '_lastSyncedAt' | '_deviceId'>,
    user: User
  ): Promise<InventoryItem> {
    const id = generateUUID();
    const itemCode = await getNextInventoryCode();
    const now = new Date().toISOString();

    const newItem: InventoryItem = {
      ...data,
      id,
      itemCode,
      createdAt: now,
      lastUpdated: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('inventory', newItem);
    await auditService.logAction('CREATE_INVENTORY_ITEM', 'Inventory', id, null, {
      itemCode,
      itemName: newItem.itemName,
      quantity: newItem.quantity,
    });

    await syncService.enqueueOperation('inventory', id, 'CREATE', newItem);
    return newItem;
  }

  public async recordTransaction(
    itemId: string,
    transactionType: InventoryTransaction['transactionType'],
    quantity: number,
    reason: string,
    reference: string,
    department: string | undefined,
    user: User
  ): Promise<{ transaction: InventoryTransaction; item: InventoryItem }> {
    const item = await this.getItemById(itemId);
    if (!item) throw new Error('Inventory item not found');

    const now = new Date().toISOString();
    const oldQty = item.quantity;
    let newQty = oldQty;

    if (transactionType === 'Stock Received' || transactionType === 'Stock Returned') {
      newQty += quantity;
    } else if (transactionType === 'Stock Issued' || transactionType === 'Damaged Stock' || transactionType === 'Expired Stock') {
      if (oldQty < quantity) {
        throw new Error(`Insufficient stock. Current available: ${oldQty} ${item.unit}`);
      }
      newQty -= quantity;
    } else if (transactionType === 'Stock Adjustment') {
      newQty = quantity; // Absolute adjustment
    }

    item.quantity = newQty;
    item.lastUpdated = now;
    item._syncStatus = 'PENDING_SYNC';
    item._syncVersion = (item._syncVersion || 1) + 1;

    await putToStore('inventory', item);

    // Create immutable transaction ledger entry
    const txId = generateUUID();
    const tx: InventoryTransaction = {
      id: txId,
      itemId: item.id,
      itemName: item.itemName,
      quantity,
      transactionType,
      reason,
      department,
      performedBy: user.fullName,
      date: now,
      reference,
      createdAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('inventoryTransactions', tx);

    // Check low stock alert
    if (newQty <= item.minimumStock) {
      await notificationService.notify(
        `Low Stock Alert: ${item.itemName}`,
        `Current stock (${newQty} ${item.unit}) has reached or fallen below minimum threshold (${item.minimumStock} ${item.unit})`,
        'warning',
        'Inventory',
        'ALL',
        item.id
      );
    }

    await auditService.logAction('INVENTORY_TRANSACTION', 'Inventory', txId, { quantity: oldQty }, { quantity: newQty, type: transactionType });
    await syncService.enqueueOperation('inventory', item.id, 'UPDATE', item);
    await syncService.enqueueOperation('inventoryTransactions', txId, 'CREATE', tx);

    return { transaction: tx, item };
  }
}

export const inventoryService = new InventoryService();
