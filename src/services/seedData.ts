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
  getDeviceId,
  generateUUID,
  setSkipSyncEnqueue,
} from './localDatabaseService';
import { memoService } from './memoService';
import { firebaseClients, isFirebaseConfigured } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
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

export async function syncLatestStaffAccounts(): Promise<User[]> {
  try {
    const existingUsers = await getAllFromStore<User>('users');
    const existingMap = new Map<string, User>();
    existingUsers.forEach((u) => {
      if (u.id) existingMap.set(u.id, u);
      if (u.username) existingMap.set(u.username.toLowerCase(), u);
      if (u.email) existingMap.set(u.email.toLowerCase(), u);
    });

    // Remove data on all users that are not still users in the system
    const obsoleteIds = new Set([
      'usr-admin-002',
      'usr-itadmin-002',
      'usr-officer-003',
      'usr-mgmt-004',
      'usr-head-005',
      'usr-staff-006',
      'usr-procure-007',
      'usr-audit-008',
    ]);
    const obsoleteUsernames = new Set([
      'mensah',
      'boateng',
      'owusu',
      'asante',
      'cudjoe',
      'agyeman',
      'kwarteng',
      'patricia',
    ]);

    for (const u of existingUsers) {
      const uName = (u.username || '').toLowerCase();
      if (obsoleteIds.has(u.id) || obsoleteUsernames.has(uName)) {
        await deleteFromStore('users', u.id);
        existingMap.delete(u.id);
        if (u.username) existingMap.delete(u.username.toLowerCase());
        if (u.email) existingMap.delete(u.email.toLowerCase());
      }
    }

    const usersToUpsert: User[] = [];

    // 1. From defaultSeedData.json snapshot
    if (defaultSeedJson?.data?.users && Array.isArray(defaultSeedJson.data.users)) {
      for (const u of defaultSeedJson.data.users) {
        const found =
          (u.id && existingMap.get(u.id)) ||
          (u.username && existingMap.get(u.username.toLowerCase())) ||
          (u.email && existingMap.get(u.email.toLowerCase()));

        if (!found) {
          usersToUpsert.push(u as User);
          if (u.id) existingMap.set(u.id, u as User);
        } else {
          let updated = false;
          const merged = { ...found };
          if (u.fullName && u.fullName !== found.fullName) {
            merged.fullName = u.fullName;
            updated = true;
          }
          if (u.username && u.username !== found.username) {
            merged.username = u.username;
            updated = true;
          }
          if (u.role && u.role !== found.role) {
            merged.role = u.role as any;
            updated = true;
          }
          if (u.password && u.password !== found.password && !found.lastPasswordChangeAt) {
            merged.password = u.password;
            updated = true;
          }
          if (u.specialties && JSON.stringify(u.specialties) !== JSON.stringify(found.specialties)) {
            merged.specialties = u.specialties;
            updated = true;
          }
          if (u.department && u.department !== found.department) {
            merged.department = u.department;
            updated = true;
          }
          if ((u.role === 'SUPER_ADMIN' || u.role === 'IT_ADMIN') && !found.signature) {
            merged.signature = found.fullName;
            updated = true;
          }
          if (updated) {
            usersToUpsert.push(merged as User);
            if (u.id) existingMap.set(u.id, merged as User);
          }
        }
      }
    }

    // 2. From Firestore if online
    if (isFirebaseConfigured() && firebaseClients.firestore) {
      try {
        const db = firebaseClients.firestore;
        const usersRef = collection(db, 'users');
        const snap = await withTimeout(getDocs(usersRef), 4000);
        if (snap && !snap.empty) {
          snap.forEach((doc) => {
            const data = doc.data() as User;
            const id = doc.id;
            const found =
              existingMap.get(id) ||
              (data.username && existingMap.get(data.username.toLowerCase())) ||
              (data.email && existingMap.get(data.email.toLowerCase()));

            if (!found) {
              const newUser = {
                ...data,
                id,
                _syncStatus: 'SYNCED' as const,
                _lastSyncedAt: new Date().toISOString(),
              };
              usersToUpsert.push(newUser);
              existingMap.set(id, newUser);
            } else {
              const remoteUpdated = new Date(data.updatedAt || 0).getTime();
              const localUpdated = new Date(found.updatedAt || 0).getTime();
              if (remoteUpdated >= localUpdated) {
                const merged = { ...found, ...data, id, _syncStatus: 'SYNCED' as const };
                usersToUpsert.push(merged);
                existingMap.set(id, merged);
              }
            }
          });
        }
      } catch (err: any) {
        console.warn('[SeedData] Note on cloud staff pull:', err?.message);
      }
    }

    if (usersToUpsert.length > 0) {
      setSkipSyncEnqueue(true);
      try {
        await putBatchToStore('users', usersToUpsert);
      } finally {
        setSkipSyncEnqueue(false);
      }
    }

    await ensureSuperAdminCourageKay();
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

export async function ensureSuperAdminCourageKay(): Promise<void> {
  try {
    const users = await getAllFromStore<User>('users');
    const courageKay = users.find(
      (u) =>
        u.fullName.toLowerCase().includes('courage') ||
        (u.username && u.username.toLowerCase() === 'kay')
    );
    const now = new Date().toISOString();
    const deviceId = getDeviceId();

    if (!courageKay) {
      const admin001 = users.find((u) => u.id === 'usr-admin-001');
      if (admin001) {
        admin001.fullName = 'Courage Kekesi';
        admin001.username = 'kay';
        admin001.email = 'courage.kay@hospital.local';
        admin001.role = 'SUPER_ADMIN';
        admin001.jobTitle = 'Chief Information Officer & Super Administrator';
        admin001.department = 'IT & Systems Administration';
        admin001.status = 'Active';
        admin001.password = '1234';
        await putToStore('users', admin001);
      } else {
        const newUser: User = {
          id: 'usr-admin-001',
          fullName: 'Courage Kekesi',
          username: 'kay',
          email: 'courage.kay@hospital.local',
          phone: '+233 24 100 0001',
          department: 'IT & Systems Administration',
          jobTitle: 'Chief Information Officer & Super Administrator',
          role: 'SUPER_ADMIN',
          status: 'Active',
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          offlineAccessAllowed: true,
          signature: 'Courage Kekesi',
          password: '1234',
          _syncStatus: 'SYNCED',
          _syncVersion: 1,
          _lastSyncedAt: now,
          _deviceId: deviceId,
        };
        await putToStore('users', newUser);
      }
    } else {
      let needsUpdate = false;
      if (courageKay.role !== 'SUPER_ADMIN') {
        courageKay.role = 'SUPER_ADMIN';
        needsUpdate = true;
      }
      if (courageKay.status !== 'Active') {
        courageKay.status = 'Active';
        needsUpdate = true;
      }
      if (!courageKay.username) {
        courageKay.username = 'kay';
        needsUpdate = true;
      }
      if (!courageKay.signature) {
        courageKay.signature = courageKay.fullName;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await putToStore('users', courageKay);
      }
    }
  } catch (err) {
    console.warn('[SeedData] Error ensuring Courage Kay super admin:', err);
  }
}

export async function initializeSeedDataIfNeeded(): Promise<void> {
  const userCount = await countStore('users');
  if (userCount > 0) {
    // Sync any updated/missing staff accounts on mobile/desktop across sessions
    await syncLatestStaffAccounts();
    await memoService.getMemos();
    return;
  }

  // If Firebase is configured, try to pull from Firestore to hydrate instead of local mock seed data
  if (isFirebaseConfigured() && firebaseClients.firestore) {
    try {
      const db = firebaseClients.firestore;
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);

      if (!usersSnap.empty) {
        console.log('[SeedData] Found existing data on Firestore. Hydrating IndexedDB from cloud seed...');
        setSkipSyncEnqueue(true);

        const collectionsToSync: Array<{ col: string; store: any }> = [
          { col: 'users', store: 'users' },
          { col: 'tickets', store: 'tickets' },
          { col: 'assets', store: 'assets' },
          { col: 'inventory', store: 'inventory' },
          { col: 'maintenance', store: 'maintenance' },
          { col: 'incidents', store: 'incidents' },
          { col: 'memos', store: 'memos' },
          { col: 'settings', store: 'settings' },
        ];

        for (const { col, store } of collectionsToSync) {
          const colRef = collection(db, col);
          const snap = await getDocs(colRef);
          const items: any[] = [];
          snap.forEach((doc) => {
            items.push({
              ...doc.data(),
              id: doc.id,
              _syncStatus: 'SYNCED',
              _lastSyncedAt: new Date().toISOString()
            });
          });
          if (items.length > 0) {
            await putBatchToStore(store, items);
          }
        }

        setSkipSyncEnqueue(false);
        await ensureSuperAdminCourageKay();
        await memoService.getMemos();
        console.log('[SeedData] Hydration from Firestore seed complete!');
        return;
      }
    } catch (e) {
      setSkipSyncEnqueue(false);
      console.warn('[SeedData] Failed to hydrate from Firestore on bootstrap. Falling back to local static seed data:', e);
    }
  }

  setSkipSyncEnqueue(true);

  // If defaultSeedData.json has saved repository snapshot data, prioritize it as the default seed
  if (defaultSeedJson && defaultSeedJson.data && defaultSeedJson.data.users && defaultSeedJson.data.users.length > 0) {
    try {
      console.log('[SeedData] Hydrating default initial state from repository snapshot defaultSeedData.json...');
      const d = defaultSeedJson.data;
      if (d.users?.length) await putBatchToStore('users', d.users);
      if (d.settings?.length) await putBatchToStore('settings', d.settings);
      if (d.hospitalSystems?.length) await putBatchToStore('hospitalSystems', d.hospitalSystems);
      if (d.assets?.length) await putBatchToStore('assets', d.assets);
      if (d.tickets?.length) await putBatchToStore('tickets', d.tickets);
      if (d.inventory?.length) await putBatchToStore('inventory', d.inventory);
      if (d.maintenance?.length) await putBatchToStore('maintenance', d.maintenance);
      if (d.incidents?.length) await putBatchToStore('incidents', d.incidents);
      if (d.memos?.length) await putBatchToStore('memos', d.memos);
      if (d.departments?.length) await putBatchToStore('departments', d.departments);

      setSkipSyncEnqueue(false);
      await ensureSuperAdminCourageKay();
      await memoService.getMemos();
      return;
    } catch (err) {
      console.warn('[SeedData] Error hydrating from defaultSeedData.json, falling back to static constants:', err);
    }
  }

  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  // 1. Initial Users (All 8 Roles + Senior IT Officers)
  const users: User[] = [
    {
      id: 'usr-admin-001',
      fullName: 'Courage Kekesi',
      username: 'kay',
      email: 'courage.kay@hospital.local',
      phone: '+233 24 100 0001',
      department: 'IT & Systems Administration',
      jobTitle: 'Chief Information Officer & Super Administrator',
      role: 'SUPER_ADMIN',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: '1234',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-45b5ac61',
      fullName: 'Edmond Gadzekpo',
      username: 'gadzekpo',
      email: 'gadzekpo@hospital.local',
      phone: '+233 24 100 0004',
      department: 'IT & Systems Administration',
      jobTitle: 'Hospital Staff / IT Admin',
      role: 'IT_ADMIN',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'ekpo',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-6e1cf172',
      fullName: 'Ebenezer Appau',
      username: 'appau',
      email: 'appau@hospital.local',
      phone: '+233 24 100 0005',
      department: 'IT & Systems Administration',
      jobTitle: 'Senior IT Manager',
      role: 'IT_ADMIN',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'ppau',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-eb7b073a',
      fullName: 'Fabris Eklu',
      username: 'eklu',
      email: 'eklu@hospital.local',
      phone: '+233 24 100 0006',
      department: 'IT & Systems Administration',
      jobTitle: 'Hospital Staff / IT Officer',
      role: 'IT_OFFICER',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'eklu',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-30ccc99d',
      fullName: 'Shadrach Ochon',
      username: 'ochon',
      email: 'ochon@hospital.local',
      phone: '+233 24 100 0007',
      department: 'Accident & Emergency (A&E)',
      jobTitle: 'Hospital Staff',
      role: 'STAFF_USER',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'chon',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-956015da',
      fullName: 'Lebuny Joan Okrofun',
      username: 'okrofun',
      email: 'okrofun@hospital.local',
      phone: '+233 24 100 0008',
      department: 'OPD (Outpatient Department)',
      jobTitle: 'Nurse',
      role: 'STAFF_USER',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'ofun',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'usr-83e40ed6',
      fullName: 'Test Staff',
      username: 'staff',
      email: 'staff@hospital.local',
      phone: '+233 24 100 0009',
      department: 'OPD (Outpatient Department)',
      jobTitle: 'Hospital Staff',
      role: 'STAFF_USER',
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      offlineAccessAllowed: true,
      password: 'taff',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 2. Hospital Departments
  const departments: Department[] = [
    {
      id: 'dept-mat',
      code: 'MAT',
      name: 'Maternity & Neonatal',
      building: 'Block A (Mother & Child)',
      floor: 'Level 1 & 2',
      headOfDepartment: 'Sister Grace Cudjoe',
      phone: 'Ext. 104',
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-pharm',
      code: 'PHARM',
      name: 'Central Pharmacy',
      building: 'Block B (Clinical Services)',
      floor: 'Ground Floor',
      headOfDepartment: 'Pharm. K. Osei',
      phone: 'Ext. 108',
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-lab',
      code: 'LAB',
      name: 'Diagnostic Laboratory',
      building: 'Block B (Clinical Services)',
      floor: 'Level 1',
      headOfDepartment: 'Dr. Linda Tetteh',
      phone: 'Ext. 112',
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-opd',
      code: 'OPD',
      name: 'Outpatient Department (OPD)',
      building: 'Block D (Ambulatory Care)',
      floor: 'Ground Floor',
      headOfDepartment: 'Dr. B. Antwi',
      phone: 'Ext. 101',
      isEmergency: false,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-ped',
      code: 'PED',
      name: "Children's Ward (Pediatrics)",
      building: 'Block A (Mother & Child)',
      floor: 'Level 3',
      headOfDepartment: 'Dr. Rebecca Amissah',
      phone: 'Ext. 105',
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-admin',
      code: 'ADMIN',
      name: 'Hospital Administration & HR',
      building: 'Block C (Administration)',
      floor: 'Level 2',
      headOfDepartment: 'Mr. Joseph Lamptey',
      phone: 'Ext. 200',
      isEmergency: false,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-fin',
      code: 'FIN',
      name: 'Finance & Accounts',
      building: 'Block C (Administration)',
      floor: 'Level 1',
      headOfDepartment: 'Mrs. Mary Ocloo',
      phone: 'Ext. 204',
      isEmergency: false,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'dept-rad',
      code: 'RAD',
      name: 'Radiology & Imaging',
      building: 'Block B (Clinical Services)',
      floor: 'Basement',
      headOfDepartment: 'Dr. C. Darko',
      phone: 'Ext. 115',
      isEmergency: true,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 3. Locations
  const locations: LocationItem[] = [
    {
      id: 'loc-01',
      building: 'Block A',
      block: 'Mother & Child',
      floor: 'Level 1',
      wardOrOffice: 'Maternity Ward Nursing Station',
      roomNumber: 'A-102',
      notes: 'Contains 2 workstations connected to LHIMS switch',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'loc-02',
      building: 'Block B',
      block: 'Clinical Services',
      floor: 'Ground Floor',
      wardOrOffice: 'Dispensing Counter',
      roomNumber: 'B-004',
      notes: 'Quixmo dispensing point & barcode thermal printers',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'loc-03',
      building: 'Block C',
      block: 'Administration',
      floor: 'Level 1',
      wardOrOffice: 'Main IT Server Room & NOC',
      roomNumber: 'C-101',
      notes: 'Primary rack, Starlink PoE injector, Cisco 3850 Core, PowerEdge server',
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 4. Hospital Systems
  const hospitalSystems: HospitalSystem[] = [
    {
      id: 'sys-lhims',
      systemName: 'LHIMS (Hospital Information Management System)',
      description: 'Core electronic health record, admissions, bed management, and consultation system.',
      owner: 'Clinical Operations',
      vendor: 'Ministry of Health / LHIMS Consortium',
      status: 'Operational',
      criticality: 'Critical',
      url: 'http://lhims.hospital.local',
      server: 'Dell PowerEdge R740 (192.168.1.100)',
      database: 'PostgreSQL 15 On-Premise',
      lastChecked: now,
      latencyMs: 12,
      uptimePercentage: 99.8,
      notes: 'Local hospital database. Accessible over internal LAN even when ISP is down.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sys-quickbooks',
      systemName: 'QuickBooks Enterprise',
      description: 'Hospital accounting, billing journals, and payroll module.',
      owner: 'Finance & Accounts',
      vendor: 'Intuit Enterprise',
      status: 'Operational',
      criticality: 'High',
      url: 'http://finance.hospital.local:8080',
      server: 'Finance VM (192.168.1.104)',
      database: 'SQL Anywhere 17',
      lastChecked: now,
      latencyMs: 18,
      uptimePercentage: 99.4,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sys-claimit',
      systemName: 'Claim IT (NHIS Claims Submission)',
      description: 'National Health Insurance claims bundling and tariff processing platform.',
      owner: 'Billing & Records',
      vendor: 'NHIA Ghana',
      status: 'Operational',
      criticality: 'High',
      url: 'http://claimit.hospital.local',
      server: 'Records Terminal 01',
      database: 'SQLite local ledger with periodic cloud bundle export',
      lastChecked: now,
      latencyMs: 22,
      uptimePercentage: 98.9,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sys-quixmo',
      systemName: 'Quixmo Pharmacy Suite',
      description: 'Drug inventory, prescription dispensary, barcode verification, and expiry alerts.',
      owner: 'Pharmacy Unit',
      vendor: 'Quixmo Health Systems',
      status: 'Operational',
      criticality: 'Critical',
      url: 'http://quixmo.hospital.local',
      server: 'App Server (192.168.1.105)',
      database: 'MariaDB 10.6',
      lastChecked: now,
      latencyMs: 14,
      uptimePercentage: 99.7,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sys-starlink',
      systemName: 'Starlink High-Performance Gateway',
      description: 'Primary satellite internet uplink delivering hospital-wide cloud synchronization and telemetry.',
      owner: 'IT Operations',
      vendor: 'SpaceX Starlink Business',
      status: 'Operational',
      criticality: 'Medium',
      url: 'http://192.168.100.1',
      server: 'Dishy V3 Roof Mast (Block C)',
      database: 'Cloud RouterOS',
      lastChecked: now,
      latencyMs: 44,
      uptimePercentage: 97.5,
      notes: 'External link. When offline, HITOMS switches seamlessly to local LAN offline operations.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sys-backup',
      systemName: 'Synology NAS Backup Server',
      description: 'Automated snapshot backup repository for LHIMS, QuickBooks, and HITOMS local data.',
      owner: 'IT Operations',
      vendor: 'Synology DiskStation DS920+',
      status: 'Operational',
      criticality: 'Critical',
      url: 'http://192.168.1.200:5000',
      server: 'Server Room Rack 2',
      database: 'RAID 10 Btrfs Storage Pool',
      lastChecked: now,
      latencyMs: 5,
      uptimePercentage: 99.9,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 5. Network Devices
  const networkDevices: NetworkDevice[] = [
    {
      id: 'net-gw-01',
      deviceName: 'Starlink Business Terminal',
      deviceType: 'Starlink Terminal',
      manufacturer: 'SpaceX',
      model: 'High Performance Gen 3',
      serialNumber: 'SL-HP-99201',
      ipAddress: '192.168.100.1',
      macAddress: '70:B3:D5:19:A1:01',
      location: 'Block C Roof Mast',
      department: 'IT Operations',
      status: 'Online',
      firmware: 'v2026.08.1',
      installationDate: '2025-04-10',
      lastMaintenance: '2026-08-15',
      predecessorId: undefined, // Top-level satellite uplink
      successorIds: ['net-rtr-01'],
      uplinkDeviceId: undefined,
      connectionType: 'Satellite RF',
      portSpeed: '220 Mbps Satellite WAN',
      canvasX: 420,
      canvasY: 40,
      notes: 'Primary satellite WAN uplink with auto-failover to local cache',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-rtr-01',
      deviceName: 'Core Edge Router',
      deviceType: 'Router',
      manufacturer: 'Cisco',
      model: 'ISR 4331/K9',
      serialNumber: 'FOC2419401B',
      ipAddress: '192.168.1.1',
      macAddress: '00:45:1D:9C:22:10',
      location: 'Server Room Rack 1',
      department: 'IT Operations',
      status: 'Online',
      firmware: 'IOS-XE 17.06.04',
      installationDate: '2024-02-15',
      lastMaintenance: '2026-07-20',
      predecessorId: 'net-gw-01',
      successorIds: ['net-sw-core', 'net-sw-mat'],
      uplinkDeviceId: 'net-gw-01',
      connectionType: 'Ethernet Cat6',
      portSpeed: '1 Gbps Full-Duplex',
      canvasX: 420,
      canvasY: 180,
      notes: 'Binds LAN 192.168.1.0/24, VLAN 10 (Clinical), VLAN 20 (Admin), VLAN 30 (Guest)',
      portsCount: 8,
      activePorts: 6,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-sw-core',
      deviceName: 'Main Core Switch',
      deviceType: 'Core Switch',
      manufacturer: 'Cisco',
      model: 'Catalyst 3850-48P-L PoE+',
      serialNumber: 'FCW2210C09A',
      ipAddress: '192.168.1.2',
      macAddress: '00:45:1D:88:AA:20',
      location: 'Server Room Rack 1',
      department: 'IT Operations',
      status: 'Online',
      firmware: 'IOS 16.12.08',
      installationDate: '2024-02-15',
      lastMaintenance: '2026-07-20',
      predecessorId: 'net-rtr-01',
      successorIds: ['net-sw-mat', 'net-sw-pharm', 'net-srv-01'],
      uplinkDeviceId: 'net-rtr-01',
      connectionType: 'SFP+ 10G',
      portSpeed: '10 Gbps SFP+ Trunk',
      canvasX: 420,
      canvasY: 330,
      notes: 'High-speed fiber backhaul connecting all distribution switches across hospital blocks',
      portsCount: 48,
      activePorts: 38,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-srv-01',
      deviceName: 'HITOMS Local Edge Server',
      deviceType: 'Server',
      manufacturer: 'Dell',
      model: 'PowerEdge R740',
      serialNumber: 'SRV-DL-8821A',
      ipAddress: '192.168.1.100',
      macAddress: '00:45:1D:99:FF:01',
      location: 'Server Room Rack 2',
      department: 'IT Infrastructure',
      status: 'Online',
      firmware: 'Ubuntu 24.04 LTS / Node 20',
      installationDate: '2024-02-15',
      lastMaintenance: '2026-08-01',
      predecessorId: 'net-sw-core',
      successorIds: [],
      uplinkDeviceId: 'net-sw-core',
      connectionType: 'Ethernet Cat6',
      portSpeed: '1 Gbps Dual LACP',
      canvasX: 740,
      canvasY: 330,
      notes: 'Hosts on-premise HITOMS offline node, SQLite local storage, and clinical sync engine',
      portsCount: 4,
      activePorts: 2,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-sw-mat',
      deviceName: 'Dist Switch Block A (Maternity)',
      deviceType: 'Managed Switch',
      manufacturer: 'Cisco',
      model: 'Catalyst 2960X-24PD-L',
      serialNumber: 'FOC2311894Z',
      ipAddress: '192.168.1.10',
      macAddress: '00:45:1D:77:33:41',
      location: 'Block A Telecom Cupboard (Level 1)',
      department: 'Maternity',
      status: 'Online',
      firmware: '15.2(7)E4',
      installationDate: '2024-03-01',
      lastMaintenance: '2026-06-10',
      predecessorId: 'net-sw-core',
      predecessorIds: ['net-sw-core', 'net-rtr-01'],
      successorIds: ['net-ap-mat', 'net-pc-nurse-01'],
      uplinkDeviceId: 'net-sw-core',
      uplinkDeviceIds: ['net-sw-core', 'net-rtr-01'],
      connectionType: 'Fiber',
      portSpeed: '1 Gbps OM3 Fiber (Trunk)',
      vlanEnabled: true,
      vlans: ['10', '20', '30', '99'],
      canvasX: 180,
      canvasY: 490,
      notes: 'Managed Switch with VLANs activated and redundant dual uplinks to Core Switch & Edge Router.',
      portsCount: 24,
      activePorts: 18,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-sw-pharm',
      deviceName: 'Dist Switch Block B (Pharmacy & Lab)',
      deviceType: 'Distribution Switch',
      manufacturer: 'Cisco',
      model: 'Catalyst 2960X-24PD-L',
      serialNumber: 'FOC2311895B',
      ipAddress: '192.168.1.11',
      macAddress: '00:45:1D:77:33:42',
      location: 'Block B Distribution Closet',
      department: 'Pharmacy',
      status: 'Online',
      firmware: '15.2(7)E4',
      installationDate: '2024-03-01',
      lastMaintenance: '2026-06-10',
      predecessorId: 'net-sw-core',
      successorIds: ['net-ap-pharm', 'net-ap-outdoor-01', 'net-pc-pharm-01', 'net-prn-rx-01'],
      uplinkDeviceId: 'net-sw-core',
      connectionType: 'Fiber',
      portSpeed: '1 Gbps OM3 Fiber',
      canvasX: 600,
      canvasY: 490,
      notes: 'Feeds Pharmacy dispensary counters, laboratory terminals, and outdoor emergency bay AP',
      portsCount: 24,
      activePorts: 22,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-ap-mat',
      deviceName: 'Maternity Hallway Wi-Fi AP',
      deviceType: 'Access Point (Indoor)',
      manufacturer: 'Ubiquiti',
      model: 'UniFi U6 Pro',
      serialNumber: 'U6P-98821',
      ipAddress: '192.168.2.20',
      macAddress: '74:83:C2:55:10:0A',
      location: 'Block A Level 1 Corridor',
      department: 'Maternity',
      status: 'Online',
      firmware: 'v6.6.65',
      installationDate: '2024-05-15',
      lastMaintenance: '2026-05-10',
      predecessorId: 'net-sw-mat',
      predecessorIds: ['net-sw-mat'],
      successorIds: ['net-lap-doc-01'],
      uplinkDeviceId: 'net-sw-mat',
      connectionType: 'Ethernet Cat6',
      portSpeed: 'PoE+ Gigabit (Wi-Fi 6)',
      apCoverageType: 'Indoor',
      maxClients: 250,
      canvasX: 180,
      canvasY: 650,
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-ap-outdoor-01',
      deviceName: 'Emergency Bay Outdoor AP',
      deviceType: 'Access Point (Outdoor)',
      manufacturer: 'Ubiquiti',
      model: 'UniFi Swiss Army Knife Ultra Outdoor',
      serialNumber: 'UKU-88190',
      ipAddress: '192.168.2.22',
      macAddress: '74:83:C2:55:10:0C',
      location: 'Emergency Ambulance Bay External Mast',
      department: 'Accident & Emergency (A&E)',
      status: 'Online',
      firmware: 'v6.6.65',
      installationDate: '2024-05-15',
      lastMaintenance: '2026-05-10',
      predecessorId: 'net-sw-pharm',
      predecessorIds: ['net-sw-pharm'],
      successorIds: [],
      uplinkDeviceId: 'net-sw-pharm',
      connectionType: 'Ethernet Cat6',
      portSpeed: 'PoE+ Gigabit (Wi-Fi 6)',
      apCoverageType: 'Outdoor',
      outdoorWeatherproofRating: 'IP67 Weatherproof / Sun-Resistant Pole Mount',
      maxClients: 350,
      canvasX: 800,
      canvasY: 650,
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-ap-pharm',
      deviceName: 'Pharmacy & Lab Wi-Fi AP',
      deviceType: 'Access Point',
      manufacturer: 'Ubiquiti',
      model: 'UniFi U6 Pro',
      serialNumber: 'U6P-98822',
      ipAddress: '192.168.2.21',
      macAddress: '74:83:C2:55:10:0B',
      location: 'Block B Ground Floor Lobby',
      department: 'Pharmacy',
      status: 'Online',
      firmware: 'v6.6.65',
      installationDate: '2024-05-15',
      lastMaintenance: '2026-05-10',
      predecessorId: 'net-sw-pharm',
      successorIds: ['net-lap-admin-01'],
      uplinkDeviceId: 'net-sw-pharm',
      connectionType: 'Ethernet Cat6',
      portSpeed: 'PoE+ Gigabit (Wi-Fi 6)',
      canvasX: 600,
      canvasY: 650,
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-pc-nurse-01',
      deviceName: 'Nurse Station All-in-One PC',
      deviceType: 'Workstation',
      manufacturer: 'HP',
      model: 'EliteOne 800 G6 AIO',
      serialNumber: 'HP-AIO-98214',
      ipAddress: '192.168.1.150',
      macAddress: '00:1B:44:11:3A:88',
      location: 'Maternity Ward Nurse Counter',
      department: 'Maternity',
      status: 'Online',
      firmware: 'Windows 11 Pro / LHIMS v2.4',
      installationDate: '2024-06-01',
      lastMaintenance: '2026-07-15',
      predecessorId: 'net-sw-mat',
      successorIds: [],
      uplinkDeviceId: 'net-sw-mat',
      connectionType: 'Ethernet Cat6',
      portSpeed: '1 Gbps Full-Duplex',
      canvasX: 80,
      canvasY: 810,
      notes: 'Tier 5 Endpoint: Primary clinical triage terminal for maternity admissions and EHR lookup',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-lap-doc-01',
      deviceName: 'Dr. Mensah Mobile Rounding Laptop',
      deviceType: 'Laptop',
      manufacturer: 'Lenovo',
      model: 'ThinkPad T14 Gen 4',
      serialNumber: 'LNV-TP-44912',
      ipAddress: '192.168.2.101',
      macAddress: '00:1B:44:22:8C:99',
      location: 'Maternity & OBGYN Ward (Mobile)',
      department: 'Maternity',
      status: 'Online',
      firmware: 'Windows 11 Pro',
      installationDate: '2024-06-15',
      lastMaintenance: '2026-08-01',
      predecessorId: 'net-ap-mat',
      successorIds: [],
      uplinkDeviceId: 'net-ap-mat',
      connectionType: 'Wireless 5GHz/6GHz',
      portSpeed: '866 Mbps Wi-Fi 6 (5GHz)',
      canvasX: 280,
      canvasY: 810,
      notes: 'Tier 5 Endpoint: Mobile laptop for doctor bedside patient rounds and digital prescriptions',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-pc-pharm-01',
      deviceName: 'Pharmacy LHIMS Dispensing PC',
      deviceType: 'Workstation',
      manufacturer: 'Dell',
      model: 'OptiPlex 7090 Micro',
      serialNumber: 'DLL-OPT-77123',
      ipAddress: '192.168.1.160',
      macAddress: '00:1B:44:33:4D:AA',
      location: 'Main Pharmacy Dispensing Counter 1',
      department: 'Pharmacy',
      status: 'Online',
      firmware: 'Ubuntu 24.04 LTS / LHIMS',
      installationDate: '2024-04-10',
      lastMaintenance: '2026-06-25',
      predecessorId: 'net-sw-pharm',
      successorIds: [],
      uplinkDeviceId: 'net-sw-pharm',
      connectionType: 'Ethernet Cat6',
      portSpeed: '1 Gbps Full-Duplex',
      canvasX: 520,
      canvasY: 810,
      notes: 'Tier 5 Endpoint: Dedicated workstation for medication dispensing and batch stock check',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-lap-admin-01',
      deviceName: 'Hospital Admin Management Laptop',
      deviceType: 'Laptop',
      manufacturer: 'Dell',
      model: 'Latitude 5440',
      serialNumber: 'DLL-LAT-55102',
      ipAddress: '192.168.2.110',
      macAddress: '00:1B:44:55:6F:CC',
      location: 'Administration Office',
      department: 'Administration',
      status: 'Online',
      firmware: 'Windows 11 Pro',
      installationDate: '2024-05-01',
      lastMaintenance: '2026-07-10',
      predecessorId: 'net-ap-pharm',
      successorIds: [],
      uplinkDeviceId: 'net-ap-pharm',
      connectionType: 'Wireless 5GHz/6GHz',
      portSpeed: '1.2 Gbps Wi-Fi 6',
      canvasX: 740,
      canvasY: 810,
      notes: 'Tier 5 Endpoint: Administrator laptop for billing verification and staffing reports',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'net-prn-rx-01',
      deviceName: 'Pharmacy Prescription Barcode Printer',
      deviceType: 'Printer',
      manufacturer: 'Zebra',
      model: 'ZD421 Healthcare Desktop Printer',
      serialNumber: 'ZBR-ZD-99120',
      ipAddress: '192.168.1.200',
      macAddress: '00:1B:44:66:7E:EE',
      location: 'Pharmacy Dispensary Station',
      department: 'Pharmacy',
      status: 'Online',
      firmware: 'Link-OS v6.7',
      installationDate: '2024-04-12',
      lastMaintenance: '2026-05-18',
      predecessorId: 'net-sw-pharm',
      successorIds: [],
      uplinkDeviceId: 'net-sw-pharm',
      connectionType: 'Ethernet Cat6',
      portSpeed: '100 Mbps Fast-Ethernet',
      canvasX: 960,
      canvasY: 810,
      notes: 'Tier 5 Endpoint: Network thermal label printer for drug dosages and patient identification barcodes',
      portsCount: 1,
      activePorts: 1,
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 6. IT Assets
  const assets: Asset[] = [
    {
      id: 'ast-001',
      assetTag: 'AST-HOSP-00101',
      assetType: 'Desktop Computer',
      manufacturer: 'Dell',
      model: 'OptiPlex 7090 Micro',
      serialNumber: 'DL-9821-X3',
      department: 'Maternity',
      location: 'Maternity Ward Nursing Station (Room A-102)',
      assignedUser: 'Nurse Joyce Agyeman',
      purchaseDate: '2024-04-12',
      purchasePrice: 950,
      supplier: 'Compuland Ghana Ltd',
      warrantyStart: '2024-04-12',
      warrantyEnd: '2027-04-12',
      condition: 'Good',
      status: 'Assigned',
      operatingSystem: 'Windows 11 Pro 64-bit',
      ipAddress: '192.168.1.145',
      macAddress: 'B4:2E:99:A1:42:01',
      specifications: 'Intel Core i5-11500, 16GB RAM, 512GB NVMe SSD',
      qrCodeData: 'HITOMS-ASSET:AST-HOSP-00101',
      notes: 'Dedicated workstation for LHIMS patient admission and vitals logging.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'ast-002',
      assetTag: 'AST-HOSP-00102',
      assetType: 'Heavy-Duty Laser Printer',
      manufacturer: 'HP',
      model: 'LaserJet Pro M404n',
      serialNumber: 'VNB3B09121',
      department: 'Maternity',
      location: 'Maternity Ward Nursing Station',
      assignedUser: 'Sister Grace Cudjoe',
      purchaseDate: '2024-04-15',
      purchasePrice: 420,
      supplier: 'K-Office Solutions',
      warrantyStart: '2024-04-15',
      warrantyEnd: '2026-04-15',
      condition: 'Good',
      status: 'Assigned',
      ipAddress: '192.168.1.180',
      macAddress: '18:66:DA:22:90:31',
      specifications: 'Monochrome, 40 ppm, Network Gigabit Ethernet',
      qrCodeData: 'HITOMS-ASSET:AST-HOSP-00102',
      notes: 'Prints delivery certificates, admission sheets, lab test request slips.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'ast-003',
      assetTag: 'AST-HOSP-00103',
      assetType: 'Desktop Computer',
      manufacturer: 'HP',
      model: 'ProDesk 400 G7 SFF',
      serialNumber: 'CZC112998Z',
      department: 'Central Pharmacy',
      location: 'Dispensing Counter B-004',
      assignedUser: 'Pharm. K. Osei',
      purchaseDate: '2024-05-10',
      purchasePrice: 880,
      supplier: 'K-Office Solutions',
      warrantyStart: '2024-05-10',
      warrantyEnd: '2027-05-10',
      condition: 'Excellent',
      status: 'Assigned',
      operatingSystem: 'Windows 11 Pro',
      ipAddress: '192.168.1.150',
      macAddress: '3C:52:82:11:45:90',
      specifications: 'Intel Core i5-10500, 16GB DDR4, 512GB SSD',
      qrCodeData: 'HITOMS-ASSET:AST-HOSP-00103',
      notes: 'Connected to Quixmo drug dispensing database and barcode reader.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'ast-004',
      assetTag: 'AST-HOSP-00104',
      assetType: 'Uninterruptible Power Supply (UPS)',
      manufacturer: 'APC by Schneider Electric',
      model: 'Smart-UPS 3000VA LCD RM 2U',
      serialNumber: 'AS1944110928',
      department: 'IT Operations',
      location: 'Server Room Rack 1',
      assignedUser: 'Emmanuel Boateng',
      purchaseDate: '2024-02-15',
      purchasePrice: 1850,
      supplier: 'PowerTech Solutions',
      warrantyStart: '2024-02-15',
      warrantyEnd: '2027-02-15',
      condition: 'Excellent',
      status: 'Assigned',
      specifications: '3000VA / 2700W, Pure Sine Wave, Extended Battery Port',
      qrCodeData: 'HITOMS-ASSET:AST-HOSP-00104',
      notes: 'Provides emergency power backup for Core Switch, LHIMS server during generator transitions.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 7. Initial Tickets (including the explicit example from Section 5 of prompt)
  const tickets: Ticket[] = [
    {
      id: 'tkt-001',
      ticketNumber: 'HIT-2026-000001',
      title: 'The computer at Maternity cannot access LHIMS',
      description: 'Workstation OptiPlex 7090 at the Maternity nursing station gives an ERR_CONNECTION_REFUSED error when loading http://lhims.hospital.local. Patients waiting for admission.',
      category: 'Hospital System',
      subcategory: 'LHIMS Access Failure',
      priority: 'Critical',
      status: 'Assigned',
      department: 'Maternity',
      location: 'Maternity Ward Nursing Station (Room A-102)',
      reportedBy: {
        uid: 'usr-staff-006',
        name: 'Nurse Joyce Agyeman',
        email: 'joyce.nurse@hospital.local',
        phone: '+233 24 400 0001',
        department: 'Maternity',
      },
      assignedTo: {
        uid: 'usr-officer-003',
        name: 'Daniel Owusu',
        email: 'itofficer@hospital.local',
      },
      assetId: 'ast-001',
      attachments: [],
      comments: [
        {
          id: 'cmt-01',
          userId: 'usr-staff-006',
          userName: 'Nurse Joyce Agyeman',
          userRole: 'STAFF_USER',
          comment: 'We have restarted the PC twice but still getting blank page on LHIMS. Other websites are not opening either.',
          createdAt: now,
        },
        {
          id: 'cmt-02',
          userId: 'usr-officer-003',
          userName: 'Daniel Owusu',
          userRole: 'IT_OFFICER',
          comment: 'Assigned to Daniel. I am carrying a spare CAT6 patch cord and testing LAN port 12 on switch net-sw-mat.',
          createdAt: now,
        },
      ],
      sla: {
        responseDue: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        resolutionDue: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        isBreached: false,
      },
      createdAt: now,
      updatedAt: now,
      assignedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'tkt-002',
      ticketNumber: 'HIT-2026-000002',
      title: 'Central Pharmacy receipt printer paper feed jammed',
      description: 'Thermal receipt printer is making grinding noise and red error light is flashing on dispensing counter 2.',
      category: 'Printer',
      priority: 'Medium',
      status: 'In Progress',
      department: 'Pharmacy',
      location: 'Dispensing Counter B-004',
      reportedBy: {
        uid: 'usr-procure-007',
        name: 'Patrick Kwarteng',
        email: 'procurement@hospital.local',
        department: 'Pharmacy',
      },
      assignedTo: {
        uid: 'usr-officer-003',
        name: 'Daniel Owusu',
        email: 'itofficer@hospital.local',
      },
      attachments: [],
      comments: [],
      sla: {
        responseDue: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        resolutionDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isBreached: false,
      },
      createdAt: now,
      updatedAt: now,
      assignedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 8. Consumables Inventory
  const inventory: InventoryItem[] = [
    {
      id: 'inv-001',
      itemCode: 'INV-CAT6-01',
      itemName: 'CAT6 UTP High-Speed Network Cable (305m Box)',
      category: 'Cabling',
      unit: 'Rolls',
      quantity: 5,
      minimumStock: 2,
      maximumStock: 10,
      supplier: 'Schneider Electric Ghana',
      unitCost: 140,
      storageLocation: 'IT Store Rack A2',
      lastUpdated: now,
      createdAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'inv-002',
      itemCode: 'INV-CAT6-02',
      itemName: 'CAT6 Outdoor Shielded UV-Resistant Cable (305m)',
      category: 'Cabling',
      unit: 'Rolls',
      quantity: 2,
      minimumStock: 2,
      maximumStock: 6,
      supplier: 'Schneider Electric Ghana',
      unitCost: 210,
      storageLocation: 'IT Store Rack A2',
      lastUpdated: now,
      createdAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'inv-003',
      itemCode: 'INV-RJ45-01',
      itemName: 'RJ45 Modular Gold-Plated Connectors (Pack of 100)',
      category: 'Connectors',
      unit: 'Packs',
      quantity: 12,
      minimumStock: 3,
      maximumStock: 25,
      supplier: 'Compuland Ghana Ltd',
      unitCost: 18,
      storageLocation: 'IT Store Drawer 1B',
      lastUpdated: now,
      createdAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'inv-004',
      itemCode: 'INV-TON-26A',
      itemName: 'HP LaserJet 26A Original Black Toner Cartridge',
      category: 'Printing',
      unit: 'Pcs',
      quantity: 3, // Low stock indicator!
      minimumStock: 4,
      maximumStock: 15,
      supplier: 'K-Office Solutions',
      unitCost: 115,
      storageLocation: 'IT Store Shelf C',
      lastUpdated: now,
      createdAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'inv-005',
      itemCode: 'INV-PER-KM01',
      itemName: 'Logitech MK120 USB Keyboard & Optical Mouse Combo',
      category: 'Peripherals',
      unit: 'Pcs',
      quantity: 8,
      minimumStock: 3,
      maximumStock: 20,
      supplier: 'Compuland Ghana Ltd',
      unitCost: 22,
      storageLocation: 'IT Store Shelf D1',
      lastUpdated: now,
      createdAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 9. Knowledge Base Troubleshooting Articles
  const knowledgeBase: KnowledgeArticle[] = [
    {
      id: 'kb-001',
      articleId: 'KB-001',
      title: 'Computer Cannot Connect to Network / LHIMS Offline',
      category: 'Network & LHIMS',
      problem: 'Staff computer displays "ERR_CONNECTION_REFUSED" or "DNS_PROBE_FINISHED_NO_INTERNET" when opening http://lhims.hospital.local.',
      symptoms: [
        'Network icon in Windows taskbar shows globe with yellow exclamation',
        'Command prompt "ping 192.168.1.100" (LHIMS) fails with Request timed out',
        'LAN port LED on wall plate or NIC is unlit',
      ],
      tags: ['LHIMS', 'LAN', 'Networking'],
      solution: 'Inspect physical RJ45 patch cable connection, verify DHCP lease in 192.168.1.x subnet, or test port on departmental distribution switch.',
      steps: [
        'Check physical connection: unplug RJ45 jack from PC and wall plate, inspect pins for bent contacts, re-seat firmly until click sound.',
        'Open Command Prompt (Win+R -> cmd) and type: ipconfig /renew',
        'Verify IPv4 address is 192.168.1.xxx. If 169.254.x.x (APIPA), switch port is down or DHCP server is unreachable.',
        'Ping local gateway: ping 192.168.1.1. If ping fails, check distribution switch uplink in telecom closet.',
        'Ping LHIMS server: ping 192.168.1.100. If reachable, clear browser cache with Ctrl+F5.',
      ],
      views: 84,
      createdBy: 'Emmanuel Boateng',
      updatedBy: 'Daniel Owusu',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'kb-002',
      articleId: 'KB-002',
      title: 'Network Printer Offline / Spooler Queue Cleared',
      category: 'Printer',
      problem: 'Documents sent to HP LaserJet Pro M404n get stuck in print queue with status "Printer Offline".',
      symptoms: [
        'Print jobs queued but not printing',
        'Printer web config page http://192.168.1.180 unreachable',
        'Printer sleep mode not waking on incoming network packet',
      ],
      tags: ['Printers', 'Hardware', 'Spooler'],
      solution: 'Restart Windows Print Spooler service, verify printer IP static assignment, and ensure SNMP status reporting is active.',
      steps: [
        'On user PC: Win+R -> services.msc -> Right click "Print Spooler" -> Restart.',
        'Check physical printer: verify power cord and blue Ethernet link LED on rear RJ45 port.',
        'Print network configuration page directly from printer control panel to verify IP address has not changed.',
        'In Windows Printers & Scanners -> HP M404n -> Printer Properties -> Ports tab -> Configure Port -> Uncheck "SNMP Status Enabled" if causing false offline reports.',
      ],
      views: 52,
      createdBy: 'Daniel Owusu',
      updatedBy: 'Daniel Owusu',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'kb-003',
      articleId: 'KB-003',
      title: 'External Internet Outage & Starlink Failover Operations',
      category: 'Internet & Synchronization',
      problem: 'External websites and external email bounce, but internal hospital LAN (LHIMS, Quixmo, HITOMS) remains fully functional.',
      symptoms: [
        'Starlink app shows "Searching" or "Obstruction / Extreme Rain Fade"',
        'ISP fiber gateway link LED blinking red or dark',
      ],
      tags: ['Starlink', 'WAN', 'Disaster Recovery'],
      solution: 'Reassure staff that HITOMS and LHIMS continue operating 100% locally. Do NOT reset core switches. Monitor Starlink obstruction telemetry.',
      steps: [
        'Verify HITOMS status bar: status will show "Offline (Hospital LAN Active)". Local ticket creation and asset management continue normally.',
        'Access Starlink router dashboard at http://192.168.100.1 to inspect dish temperature, snow melt, and satellite constellation tracking.',
        'Once external satellite signal returns, HITOMS SyncService automatically uploads all pending local tickets, comments, and audit logs without user intervention.',
      ],
      views: 110,
      createdBy: 'Emmanuel Boateng',
      updatedBy: 'Dr. Sarah Mensah',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sop-001',
      articleId: 'SOP-001',
      title: 'SOP: How to Clear Browser Data in Google Chrome or Microsoft Edge',
      category: 'Browser & EHR',
      problem: 'LHIMS pages freeze, show stale patient records, or produce unexpected display glitch after system update.',
      symptoms: [
        'Stale patient clinical records displaying on nurse workstation',
        'Blank white screen when opening LHIMS interface',
        'Button clicks unresponsive in Chrome or Edge',
      ],
      tags: ['Chrome', 'Edge', 'Browser', 'Cache', 'LHIMS'],
      solution: 'Clear browser cookies and cached images/files across All Time, then restart browser and re-open http://10.10.16.50/lhims_245.',
      steps: [
        'Open Google Chrome or Microsoft Edge on your workstation computer.',
        'Press the keyboard shortcut Ctrl + Shift + Delete (or click 3 dots menu at top-right -> Settings -> Clear Browsing Data).',
        'In the pop-up window, select Time Range dropdown and set to "All time" (or "Everything").',
        'Check the boxes for "Cookies and other site data" and "Cached images and files".',
        'Click the blue "Clear data" / "Clear now" button and wait a few seconds.',
        'Close all open browser windows, re-open Chrome or Edge, and enter http://10.10.16.50/lhims_245.',
      ],
      views: 142,
      createdBy: 'IT Operations Unit',
      updatedBy: 'IT Admin / Super Admin',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sop-002',
      articleId: 'SOP-002',
      title: 'SOP: How to Disconnect and Connect to Hospital eHealth Wi-Fi',
      category: 'Network & Wi-Fi',
      problem: 'Staff mobile tablet or laptop loses wireless network connection to hospital eHealth Wi-Fi or shows IP conflict.',
      symptoms: [
        'Wi-Fi icon displays yellow warning or disconnected globe',
        'LHIMS Mobile App displays "Host Unreachable"',
        'Unable to roam between ward Access Points',
      ],
      tags: ['Wi-Fi', 'eHealth', 'Wireless', 'Password', 'Network'],
      solution: 'Connect to SSID "eHealth" using wireless security key "1234567890". Enable Connect Automatically for ward roaming.',
      steps: [
        'Click the Wi-Fi / Network icon in bottom-right corner of Windows taskbar (or top-right of mobile tablet).',
        'If connected to wrong network, click Disconnect. Right-click "eHealth" and select "Forget" if credentials were corrupt.',
        'Select the network named "eHealth" from the list of available wireless SSIDs.',
        'Check the box "Connect automatically" to enable seamless roaming across ward Access Points.',
        'Click Connect. When prompted for Security Key / Password, type: 1234567890',
        'Click Next / Join. Verify connection status reads "Connected, secured" with valid IP address.',
      ],
      views: 189,
      createdBy: 'IT Operations Unit',
      updatedBy: 'IT Admin / Super Admin',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sop-003',
      articleId: 'SOP-003',
      title: 'SOP: How to Properly Boot, Restart, or Shutdown a Workstation Computer',
      category: 'Hardware & OS',
      problem: 'Workstation computer sluggish, barcode scanner unresponsive, or system requires routine power cycle.',
      symptoms: [
        'Computer running for days without rebooting',
        'USB barcode scanner or label printer unresponsive',
        'High RAM memory usage causing clinical system lag',
      ],
      tags: ['Workstation', 'Power', 'Restart', 'Boot', 'Shutdown'],
      solution: 'Gracefully save work, exit open software, and perform Windows Restart or Shutdown. Press physical power button to boot.',
      steps: [
        'Save all open clinical documents and exit active software applications.',
        'Click the Windows Start Menu icon in bottom-left corner of the screen.',
        'Click the Power button icon symbol.',
        'Select "Restart" (for soft reset/system glitch) or "Shutdown" (for end of shift / severe storm alert).',
        'To Boot On: Press the physical Power button on front of desktop tower or laptop lid once.',
        'Wait for Windows login prompt, enter official credentials, and verify LAN connection icon is lit.',
      ],
      views: 165,
      createdBy: 'IT Operations Unit',
      updatedBy: 'IT Admin / Super Admin',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sop-004',
      articleId: 'SOP-004',
      title: 'SOP: Opening Browser & Entering LHIMS EHR and CPH Inventory Web URLs',
      category: 'Hospital Systems & LHIMS',
      problem: 'Clinical, ward, or pharmacy staff need exact internal IP web addresses for LHIMS EHR and Inventory Requisitions.',
      symptoms: [
        'Error 404 or "Site cannot be reached" when typing public domain names',
        'Staff entering incorrect IP address or port number',
        'New staff orientation for electronic health records',
      ],
      tags: ['LHIMS', 'EHR', 'Inventory', 'CPH', 'URL', 'Browser'],
      solution: 'Enter 10.10.16.50/lhims_245 for Electronic Health Records and 10.10.16.50/lhims_245/CPH for CPH Inventory Requisitions.',
      steps: [
        'Launch Google Chrome or Microsoft Edge from desktop shortcut.',
        'Click the address bar at the top of the browser window and clear any existing URL text.',
        'For LHIMS Electronic Health Records (EHR): Type 10.10.16.50/lhims_245 and press Enter.',
        'For Inventory Requisitions & CPH Portal: Type 10.10.16.50/lhims_245/CPH and press Enter.',
        'Bookmark both URLs by pressing Ctrl + D on keyboard so they appear in browser top bar for 1-click access.',
        'Enter staff clinical username and password, then confirm active department station.',
      ],
      views: 220,
      createdBy: 'IT Operations Unit',
      updatedBy: 'IT Admin / Super Admin',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 10. Software Licenses & Cloud Subscriptions (Antivirus, MS 365, LHIMS, Starlink)
  const subscriptions: SoftwareSubscription[] = [
    {
      id: 'sub-001',
      subscriptionCode: 'SUB-2026-001',
      softwareName: 'Kaspersky Endpoint Security Cloud Plus',
      category: 'Antivirus & Endpoint Security',
      vendor: 'Kaspersky Labs',
      licenseKey: 'KASP-9921-HOSP-CLINIC-7740-XXXX',
      licenseType: 'Per Device',
      totalSeats: 150,
      allocatedSeats: 138,
      purchaseDate: '2025-12-15',
      renewalDate: '2026-12-15',
      cost: 3450,
      currency: 'GH₵',
      billingCycle: 'Annual',
      status: 'Active',
      autoRenew: true,
      assignedDepartment: 'Hospital-Wide IT & Clinical Endpoints',
      primaryAdminContact: 'Emmanuel Boateng (Lead Systems Admin)',
      notes: 'Covers real-time antivirus, ransomware shield, and USB mass-storage lockdown on all clinical OPD, ICU, and Lab workstations.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sub-002',
      subscriptionCode: 'SUB-2026-002',
      softwareName: 'Microsoft 365 Business Standard',
      category: 'Office & Productivity',
      vendor: 'Microsoft Corporation',
      licenseKey: 'MS365-HOSP-E3-ENTERPRISE-9921-AAAA',
      licenseType: 'Per User / Seat',
      totalSeats: 80,
      allocatedSeats: 74,
      purchaseDate: '2025-04-01',
      renewalDate: '2027-03-31',
      cost: 12000,
      currency: 'GH₵',
      billingCycle: 'Annual',
      status: 'Active',
      autoRenew: true,
      assignedDepartment: 'Administration, Medical Leads, Nursing Supervisors',
      primaryAdminContact: 'Daniel Owusu (IT Support Officer)',
      notes: 'Includes Outlook Hospital Email, Word, Excel, Teams, and 1TB OneDrive cloud storage for senior clinical management.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sub-003',
      subscriptionCode: 'SUB-2026-003',
      softwareName: 'LHIMS Clinical Core Enterprise License',
      category: 'Hospital & Clinical (LHIMS)',
      vendor: 'Ministry of Health / LHIMS Digital Health',
      licenseKey: 'LHIMS-GH-HOSP-LIC-2026-PROD-9988',
      licenseType: 'Site License (Unlimited)',
      totalSeats: 350,
      allocatedSeats: 320,
      purchaseDate: '2025-10-01',
      renewalDate: '2026-10-01',
      cost: 8500,
      currency: 'GH₵',
      billingCycle: 'Annual',
      status: 'Expiring Soon',
      autoRenew: false,
      assignedDepartment: 'Clinical & Patient Records',
      primaryAdminContact: 'Emmanuel Boateng (Lead Systems Admin)',
      notes: 'Full institutional license for electronic health records, OPD queueing, pharmacy dispense, and inpatient admissions.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sub-004',
      subscriptionCode: 'SUB-2026-004',
      softwareName: 'Starlink Priority 1TB Maritime & Business WAN',
      category: 'Network & Satellite (Starlink)',
      vendor: 'SpaceX Starlink Satellite WAN',
      licenseKey: 'SL-SRV-KIT-002919-PRIORITY-WAN',
      licenseType: 'Per Device',
      totalSeats: 1,
      allocatedSeats: 1,
      purchaseDate: '2025-11-20',
      renewalDate: '2026-11-20',
      cost: 3000,
      currency: 'GH₵',
      billingCycle: 'Annual',
      status: 'Active',
      autoRenew: true,
      assignedDepartment: 'IT Operations (Primary Satellite Gateway)',
      primaryAdminContact: 'Emmanuel Boateng',
      notes: 'Priority 220 Mbps high-throughput satellite connection for remote healthcare synchronization and LHIMS sync.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
    {
      id: 'sub-005',
      subscriptionCode: 'SUB-2026-005',
      softwareName: 'VMware vSphere 8 Standard Hypervisor',
      category: 'Operating System & Server',
      vendor: 'Broadcom / VMware Inc.',
      licenseKey: 'VMW-VSPHERE8-HOSP-SRV-9912-BBCC',
      licenseType: 'Server Core',
      totalSeats: 8,
      allocatedSeats: 8,
      purchaseDate: '2024-06-30',
      renewalDate: '2027-06-30',
      cost: 4800,
      currency: 'GH₵',
      billingCycle: 'Annual',
      status: 'Active',
      autoRenew: false,
      assignedDepartment: 'Data Center / Virtualization Cluster',
      primaryAdminContact: 'Emmanuel Boateng',
      notes: 'Runs core host virtualization for LHIMS Database Server, PACS Imaging Server, and Active Directory Domain Controller.',
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'SYNCED',
      _syncVersion: 1,
      _lastSyncedAt: now,
      _deviceId: deviceId,
    },
  ];

  // 11. System Settings & Default SLA Rules
  let settings: SystemSettings = {
    id: 'main',
    hospitalName: 'St. Mary Theresa Catholic Hospital',
    hospitalLanUrl: 'http://hitoms.local',
    contactEmail: 'it-support@stmarytheresa-hospital.local',
    cloudSyncEnabled: true,
    autoSyncIntervalSec: 30,
    offlinePolicy: {
      allowOfflineLogin: true,
      maxOfflineHours: 72,
      allowOfflineTicketCreation: true,
      allowOfflineAssetModification: true,
      allowOfflineInventoryTx: true,
      allowOfflineAdmin: true,
    },
    slaRules: {
      Critical: { priority: 'Critical', responseHours: 1, resolutionHours: 4 },
      High: { priority: 'High', responseHours: 2, resolutionHours: 8 },
      Medium: { priority: 'Medium', responseHours: 4, resolutionHours: 24 },
      Low: { priority: 'Low', responseHours: 8, resolutionHours: 72 },
    },
    lastSuccessfulSync: now,
  };

  // Preserve custom facility settings if user edited them previously
  try {
    const rawCustom = localStorage.getItem('hitoms_facility_settings');
    if (rawCustom) {
      const parsed = JSON.parse(rawCustom);
      if (parsed.hospitalName && !parsed.hospitalName.includes('St. Jude')) {
        settings = { ...settings, ...parsed };
      }
    }
  } catch (e) {
    console.warn('[SeedData] Could not load custom facility settings from localStorage:', e);
  }

  // Seed into IndexedDB stores
  await putBatchToStore('users', users);
  await putBatchToStore('departments', departments);
  await putBatchToStore('locations', locations);
  await putBatchToStore('hospitalSystems', hospitalSystems);
  await putBatchToStore('networkDevices', networkDevices);
  await putBatchToStore('assets', assets);
  await putBatchToStore('subscriptions', subscriptions);
  await putBatchToStore('tickets', tickets);
  await putBatchToStore('inventory', inventory);
  await putBatchToStore('knowledgeBase', knowledgeBase);
  await putToStore('settings', { ...settings, id: 'main' });
  await putToStore('settings', { ...settings, id: 'app_settings' });

  setSkipSyncEnqueue(false);
  console.log('HITOMS initial seed data populated successfully.');
}
