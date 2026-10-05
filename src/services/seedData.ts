import {
  type User,
  type Department,
  type LocationItem,
  type Ticket,
  type Asset,
  type SoftwareSubscription,
  type AssetHistoryEntry,
  type MaintenanceRecord,
  type Incident,
  type HospitalSystem,
  type NetworkDevice,
  type InventoryItem,
  type KnowledgeArticle,
  type SystemSettings,
} from '../types';
import {
  countStore,
  getAllFromStore,
  putBatchToStore,
  putToStore,
  deleteFromStore,
  clearStore,
  getDeviceId,
  generateUUID,
  setSkipSyncEnqueue,
  recordTombstone,
} from './localDatabaseService';
import { memoService } from './memoService';
import { firebaseClients, isFirebaseConfigured } from './firebaseConfig';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import defaultSeedJson from '../data/defaultSeedData.json';

// Helper to prevent any Firestore / Network call from hanging indefinitely
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 5000, fallbackVal?: T): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fallbackVal !== undefined) {
        resolve(fallbackVal);
      } else {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export async function purgeAllPastUsersAndDepartments(): Promise<void> {
  try {
    const existingUsers = await getAllFromStore<User>('users');
    for (const u of existingUsers) {
      const isSuperAdmin = u.role === 'SUPER_ADMIN' || u.username?.toLowerCase() === 'admin';
      if (!isSuperAdmin) {
        await deleteFromStore('users', u.id);
      }
    }

    // Permanently remove all assets from local store and Firestore
    const existingAssets = await getAllFromStore<Asset>('assets');
    for (const a of existingAssets) {
      await deleteFromStore('assets', a.id);
    }

    const existingDepts = await getAllFromStore<Department>('departments');
    for (const d of existingDepts) {
      await deleteFromStore('departments', d.id);
    }

    await ensureDefaultSuperAdmin();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_users_synced', { detail: { count: 1 } })
      );
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { deletedAll: true } })
      );
      window.dispatchEvent(
        new CustomEvent('hitoms_assets_updated', { detail: { count: 0 } })
      );
    }
  } catch (err) {
    console.warn('[SeedData] Error purging past users & departments:', err);
  }
}

/**
 * Performs a comprehensive system clean purge of legacy mock assets, demo users,
 * and deprecated departments ("IT Operations", "General Clinical") from both
 * local storage and Firestore.
 */
export async function performSystemCleanPurge(): Promise<void> {
  // Legacy clean purge is disabled to protect active hospital records, departments, users and assets across domains and devices.
  return;
}

export async function syncLatestStaffAccounts(): Promise<User[]> {
  try {
    if (isFirebaseConfigured() && firebaseClients.firestore) {
      console.log('[SeedData] Syncing latest staff accounts from Firestore...');
      const db = firebaseClients.firestore;
      const usersRef = collection(db, 'users');
      // Fetch with timeout to prevent hanging if offline or credentials are bad
      const snap = await withTimeout(getDocs(usersRef), 4000).catch(() => null);

      if (snap && !snap.empty) {
        const items: User[] = [];
        snap.forEach((doc) => {
          items.push({
            ...doc.data(),
            id: doc.id,
            _syncStatus: 'SYNCED',
            _lastSyncedAt: new Date().toISOString()
          } as User);
        });

        if (items.length > 0) {
          await putBatchToStore('users', items);
        }
      }
    }

    await ensureDefaultSuperAdmin();
    const finalUsers = await getAllFromStore<User>('users');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_users_synced', { detail: { count: finalUsers.length } })
      );
    }
    return finalUsers;
  } catch (e) {
    console.warn('[SeedData] Error in syncLatestStaffAccounts:', e);
    return getAllFromStore<User>('users');
  }
}

export async function ensureDefaultSuperAdmin(): Promise<void> {
  try {
    const users = await getAllFromStore<User>('users');
    // Purge any lingering "Test Admin" account
    for (const u of users) {
      if (u.fullName === 'Test Admin' || u.id === 'usr-26fdae81') {
        await deleteFromStore('users', u.id);
      }
    }

    const currentUsers = await getAllFromStore<User>('users');
    const superAdmin = currentUsers.find(
      (u) =>
        u.role === 'SUPER_ADMIN' ||
        (u.fullName && u.fullName.toLowerCase().includes('courage')) ||
        (u.username && (u.username.toLowerCase() === 'admin' || u.username.toLowerCase() === 'kay'))
    );
    const now = new Date().toISOString();
    const deviceId = getDeviceId();

    if (!superAdmin) {
      const admin001 = currentUsers.find((u) => u.id === 'usr-admin-001');
      if (admin001) {
        admin001.fullName = 'Courage Kekesi';
        admin001.username = 'admin';
        admin001.email = 'courage.kay@hospital.local';
        admin001.role = 'SUPER_ADMIN';
        admin001.jobTitle = 'Senior IT Manager & Super Administrator';
        admin001.department = 'IT & Systems Administration';
        admin001.status = 'Active';
        await putToStore('users', admin001);
      } else {
        const newUser: User = {
          id: 'usr-admin-001',
          fullName: 'Courage Kekesi',
          username: 'admin',
          email: 'courage.kay@hospital.local',
          phone: '+233 24 174 4004',
          department: 'IT & Systems Administration',
          jobTitle: 'Senior IT Manager & Super Administrator',
          role: 'SUPER_ADMIN',
          status: 'Active',
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          offlineAccessAllowed: true,
          signature: 'Courage Kekesi',
          _syncStatus: 'SYNCED',
          _syncVersion: 1,
          _lastSyncedAt: now,
          _deviceId: deviceId,
        };
        await putToStore('users', newUser);
      }
    } else {
      let needsUpdate = false;
      if (superAdmin.role !== 'SUPER_ADMIN') {
        superAdmin.role = 'SUPER_ADMIN';
        needsUpdate = true;
      }
      if (superAdmin.status !== 'Active') {
        superAdmin.status = 'Active';
        needsUpdate = true;
      }
      if (!superAdmin.username) {
        superAdmin.username = 'admin';
        needsUpdate = true;
      }
      if (!superAdmin.signature) {
        superAdmin.signature = superAdmin.fullName;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await putToStore('users', superAdmin);
      }
    }
  } catch (err) {
    console.warn('[SeedData] Error ensuring default super admin:', err);
  }
}

export async function initializeSeedDataIfNeeded(): Promise<void> {
  const d = (defaultSeedJson as any)?.data;

  // Check counts for all primary stores
  const [
    deptCount,
    assetCount,
    userCount,
    networkCount,
    systemsCount,
    ticketsCount,
    inventoryCount,
    locationsCount,
    subsCount,
    kbCount,
    memosCount,
    settingsCount,
  ] = await Promise.all([
    countStore('departments'),
    countStore('assets'),
    countStore('users'),
    countStore('networkDevices'),
    countStore('hospitalSystems'),
    countStore('tickets'),
    countStore('inventory'),
    countStore('locations'),
    countStore('subscriptions'),
    countStore('knowledgeBase'),
    countStore('memos'),
    countStore('settings'),
  ]);

  setSkipSyncEnqueue(true);
  try {
    // Requested total purge of all departments and user department unassignment
    const purgeFlag = 'hitoms_departments_purged_requested_v5';
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(purgeFlag)) {
      console.log('[SeedData] Executing requested total purge of all departments and unassigning user departments...');
      try {
        const existingDepts = await getAllFromStore<Department>('departments');
        for (const d of existingDepts) {
          if (d.id) {
            recordTombstone('departments', d.id);
          }
        }
      } catch (e) {}

      await clearStore('departments');

      // Unassign departments for all existing local users
      try {
        const existingUsers = await getAllFromStore<User>('users');
        if (existingUsers.length > 0) {
          const unassignedUsers = existingUsers.map((u) => ({
            ...u,
            department: '',
            departments: [],
          }));
          await putBatchToStore('users', unassignedUsers);
        }
      } catch (e) {}

      try {
        const queue = await getAllFromStore<any>('syncQueue');
        const filteredQueue = (queue || []).filter((q) => q.entityType !== 'departments');
        await clearStore('syncQueue');
        if (filteredQueue.length > 0) {
          await putBatchToStore('syncQueue', filteredQueue);
        }
      } catch (e) {}

      try {
        fetch('/api/purge-all-departments', { method: 'POST' }).catch(() => {});
      } catch (e) {}

      if (isFirebaseConfigured() && firebaseClients.firestore) {
        try {
          const { collection, getDocs, writeBatch, doc } = await import('firebase/firestore');
          const colRef = collection(firebaseClients.firestore, 'departments');
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            const batch = writeBatch(firebaseClients.firestore);
            snap.docs.forEach((d) => {
              batch.delete(doc(firebaseClients.firestore!, 'departments', d.id));
            });
            await batch.commit();
          }
        } catch (e) {}
      }

      localStorage.setItem(purgeFlag, 'true');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hitoms_departments_updated', { detail: { purgeAll: true } })
        );
        window.dispatchEvent(
          new CustomEvent('hitoms_users_synced', { detail: { unassigned: true } })
        );
      }
    }

    // Purge old legacy mock assets if requested
    const assetPurgeFlag = 'hitoms_old_mock_assets_purged_v2';
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(assetPurgeFlag)) {
      try {
        const oldMockTags = new Set([
          'HIT-AST-00105',
          'HIT-AST-00106',
          'HIT-AST-00107',
          'HIT-AST-00108',
          'HIT-AST-70145',
          'HIT-AST-23446',
          'HIT-AST-44354',
          'HIT-AST-50198',
        ]);
        const existingAssets = await getAllFromStore<Asset>('assets');
        for (const a of existingAssets) {
          if (oldMockTags.has(a.assetTag)) {
            await deleteFromStore('assets', a.id);
          }
        }
      } catch (e) {}
      localStorage.setItem(assetPurgeFlag, 'true');
    }

    if (d) {
      // 1. Departments auto-hydration is permanently removed so user-deleted departments stay deleted

      // 2. Users: Ensure all staff accounts exist without assigned departments
      if (d.users?.length) {
        const existingUsers = await getAllFromStore<User>('users');
        const existingUserIds = new Set(existingUsers.map((item) => item.id));
        const missingUsers = d.users
          .filter((item: any) => !existingUserIds.has(item.id))
          .map((item: any) => ({
            ...item,
            department: '',
            departments: [],
          }));

        if (missingUsers.length > 0) {
          console.log(`[SeedData] Hydrating ${missingUsers.length} missing staff accounts (unassigned)...`);
          await putBatchToStore('users', missingUsers);
        }
      }

      // 3. Assets: Ensure all assets exist and normalize fields
      if (d.assets?.length) {
        const existingAssets = await getAllFromStore<Asset>('assets');
        const existingAssetIds = new Set(existingAssets.map((item) => item.id));
        const missingAssets = d.assets
          .filter((item: any) => !existingAssetIds.has(item.id))
          .map((item: any) => {
            const mfg = item.manufacturer && item.manufacturer !== 'Unspecified Manufacturer' ? item.manufacturer : '';
            const mdl = item.model && item.model !== 'Standard Equipment' ? item.model : '';
            const combined = [mfg, mdl].filter(Boolean).join(' ').trim();
            const fallbackName = `${item.assetType || 'Hospital IT Asset'}${item.assetTag ? ` (${item.assetTag})` : ''}`;
            const finalName = item.name || combined || fallbackName;

            return {
              ...item,
              name: finalName,
              type: item.type || item.assetType || 'Desktop',
              assetType: item.assetType || item.type || 'Desktop',
              manufacturer: item.manufacturer || 'Standard Equipment',
              model: item.model || 'Standard',
              department: item.department || 'IT & Systems Administration',
              condition: item.condition || 'Good',
              status: item.status || 'Active',
            };
          });
        if (missingAssets.length > 0) {
          console.log(`[SeedData] Hydrating ${missingAssets.length} missing assets...`);
          await putBatchToStore('assets', missingAssets);
        }
      }

      // 4. Network Devices
      if (d.networkDevices?.length) {
        const existingDevices = await getAllFromStore<NetworkDevice>('networkDevices');
        const existingDeviceIds = new Set(existingDevices.map((item) => item.id));
        const missingDevices = d.networkDevices.filter((item: any) => !existingDeviceIds.has(item.id));
        if (missingDevices.length > 0) {
          console.log(`[SeedData] Hydrating ${missingDevices.length} missing network devices...`);
          await putBatchToStore('networkDevices', missingDevices);
        }
      }

      // 5. Systems & other collections
      if (systemsCount === 0 && d.hospitalSystems?.length) {
        await putBatchToStore('hospitalSystems', d.hospitalSystems);
      }
      if (ticketsCount === 0 && d.tickets?.length) {
        await putBatchToStore('tickets', d.tickets);
      }
      if (inventoryCount === 0 && d.inventory?.length) {
        await putBatchToStore('inventory', d.inventory);
      }
      if (locationsCount === 0 && d.locations?.length) {
        await putBatchToStore('locations', d.locations);
      }
      if (subsCount === 0 && d.subscriptions?.length) {
        await putBatchToStore('subscriptions', d.subscriptions);
      }
      if (kbCount === 0 && d.knowledgeBase?.length) {
        await putBatchToStore('knowledgeBase', d.knowledgeBase);
      }
      const currentSettings = await getAllFromStore<any>('settings');
      const isMemosInited =
        (typeof localStorage !== 'undefined' && localStorage.getItem('HITOMS_MEMOS_INITIALIZED') === 'true') ||
        currentSettings.some((s) => s.id === 'memos_initialized');

      if (memosCount === 0 && d.memos?.length && !isMemosInited) {
        await putBatchToStore('memos', d.memos);
      }
      if (settingsCount === 0 && d.settings?.length) {
        await putBatchToStore('settings', d.settings);
      }
    }
  } catch (err) {
    console.warn('[SeedData] Error hydrating stores from defaultSeedData.json:', err);
  } finally {
    setSkipSyncEnqueue(false);
  }

  // Ensure default super admin account exists and is valid
  await ensureDefaultSuperAdmin();

  // Load memos
  await memoService.getMemos();
}
