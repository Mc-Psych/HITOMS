import { type Department, type User } from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  putBatchToStore,
  deleteFromStore,
  clearStore,
  generateUUID,
  getDeviceId,
  recordTombstone,
} from './localDatabaseService';
import { auditService } from './auditService';
import { syncService } from './syncService';
import { firebaseClients, isFirebaseConfigured } from './firebaseConfig';

export const INITIAL_STANDARD_DEPARTMENTS: string[] = [];

export function generateDepartmentCode(name: string): string {
  if (!name || typeof name !== 'string' || !name.trim()) return '';
  const trimmed = name.trim();

  // 1. Check if name contains explicit abbreviation in parentheses, e.g. "Intensive Care Unit (ICU)", "Accident & Emergency (A&E)", "Outpatient Department (OPD)"
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const candidate = parenMatch[1].replace(/[^a-zA-Z0-9&]/g, '').trim().toUpperCase();
    if (candidate.length >= 2 && candidate.length <= 7) {
      return candidate;
    }
  }

  // 2. Common clinical standard mapping
  const lower = trimmed.toLowerCase();
  if (lower.includes('emergency') || lower.includes('accident')) return 'A&E';
  if (lower.includes('intensive care') || lower.includes('icu')) return 'ICU';
  if (lower.includes('outpatient') || lower.includes('opd')) return 'OPD';
  if (lower.includes('pediatric') || lower.includes('paediatric')) return 'PED';
  if (lower.includes('pharmacy')) return 'PHARM';
  if (lower.includes('laboratory') || lower.includes('lab')) return 'LAB';
  if (lower.includes('theatre') || lower.includes('surgery') || lower.includes('surgical')) return 'THEATRE';
  if (lower.includes('maternity') || lower.includes('labour') || lower.includes('labor')) return 'MAT';
  if (lower.includes('radiology') || lower.includes('x-ray') || lower.includes('imaging')) return 'RAD';
  if (lower.includes('information technology') || lower.includes('telecom')) return 'IT';
  if (lower.includes('records') || lower.includes('lhims')) return 'HIMS';
  if (lower.includes('dental')) return 'DENT';
  if (lower.includes('dialysis') || lower.includes('renal')) return 'RENAL';
  if (lower.includes('cardiology')) return 'CARD';
  if (lower.includes('oncology')) return 'ONC';
  if (lower.includes('physiotherapy')) return 'PHYSIO';
  if (lower.includes('biomedical')) return 'BIOMED';
  if (lower.includes('administration') || lower.includes('admin')) return 'ADMIN';
  if (lower.includes('accounts') || lower.includes('finance') || lower.includes('billing')) return 'FIN';
  if (lower.includes('procurement') || lower.includes('stores')) return 'STORES';
  if (lower.includes('morgue') || lower.includes('pathology')) return 'PATH';

  // 3. Extract words and build acronym
  const words = trimmed
    .replace(/[^a-zA-Z0-9\s&]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].substring(0, 5).toUpperCase();
  }

  // Filter out minor stop words like "and", "of", "the", "for", "in", "to", "at"
  const significantWords = words.filter(
    (w) => !['and', 'of', 'the', 'for', 'in', 'to', 'at', '&'].includes(w.toLowerCase())
  );

  const wordsForAcronym = significantWords.length >= 2 ? significantWords : words;
  const acronym = wordsForAcronym.map((w) => w[0]).join('').toUpperCase();
  if (acronym.length >= 2 && acronym.length <= 6) {
    return acronym;
  }

  return (words[0].substring(0, 3) + (words[1] ? words[1].substring(0, 3) : '')).toUpperCase();
}

class DepartmentService {
  public async getDepartments(): Promise<Department[]> {
    const list = await getAllFromStore<Department>('departments');
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async getDepartmentById(id: string): Promise<Department | null> {
    return getFromStore<Department>('departments', id);
  }

  public async getStandardDepartmentNames(): Promise<string[]> {
    const depts = await this.getDepartments();
    const names = new Set<string>();
    depts.forEach((d) => {
      if (d.name && d.name.trim()) names.add(d.name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  public async ensureDepartmentExists(name: string, currentUser?: User | null): Promise<Department> {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Department name cannot be empty');
    }
    const existing = await this.getDepartments();
    const match = existing.find((d) => (d.name || '').toLowerCase() === cleanName.toLowerCase());
    if (match) return match;

    // Generate unique code
    const existingCodes = new Set(existing.map((d) => (d.code || '').toUpperCase()));
    let baseCode = generateDepartmentCode(cleanName);
    let code = baseCode;
    let counter = 1;
    while (existingCodes.has(code)) {
      code = `${baseCode}${counter}`;
      counter++;
    }

    const isEmergency =
      cleanName.toLowerCase().includes('emergency') ||
      cleanName.toLowerCase().includes('icu') ||
      cleanName.toLowerCase().includes('theatre') ||
      cleanName.toLowerCase().includes('maternity') ||
      cleanName.toLowerCase().includes('pediatric');

    return await this.createDepartment(
      {
        code,
        name: cleanName,
        building: 'Main Hospital Complex',
        floor: 'Ground Floor',
        headOfDepartment: '',
        phone: 'Ext. ',
        isEmergency,
      },
      currentUser
    );
  }

  public async ensureDepartmentsExist(names: string[], currentUser?: User | null): Promise<void> {
    for (const name of names) {
      if (name && typeof name === 'string' && name.trim()) {
        await this.ensureDepartmentExists(name.trim(), currentUser);
      }
    }
  }

  public async createDepartment(
    data: {
      code: string;
      name: string;
      building?: string;
      floor?: string;
      locationDescription?: string;
      headOfDepartment: string;
      phone: string;
      isEmergency: boolean;
    },
    currentUser?: User | null
  ): Promise<Department> {
    const cleanName = (data.name || '').trim();
    const cleanCode = (data.code || '').trim().toUpperCase();

    if (!cleanName) {
      throw new Error('Department name is required.');
    }
    if (!cleanCode) {
      throw new Error('Department code is required.');
    }

    const existingDepts = await this.getDepartments();
    const nameDuplicate = existingDepts.find(
      (d) => (d.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (nameDuplicate) {
      throw new Error(`A department with name "${cleanName}" already exists.`);
    }

    const codeDuplicate = existingDepts.find(
      (d) => (d.code || '').trim().toUpperCase() === cleanCode
    );
    if (codeDuplicate) {
      throw new Error(`A department with code "${cleanCode}" already exists (${codeDuplicate.name}).`);
    }

    const now = new Date().toISOString();
    const locDesc = (data.locationDescription || '').trim();
    const bldg = (data.building || (locDesc ? locDesc : 'Main Hospital Complex')).trim();
    const flr = (data.floor || '').trim();

    const newDept: Department = {
      id: `dept-${generateUUID().substring(0, 8)}`,
      code: cleanCode,
      name: cleanName,
      building: bldg,
      floor: flr,
      locationDescription: locDesc || (flr ? `${bldg}, ${flr}` : bldg),
      headOfDepartment: (data.headOfDepartment || '').trim(),
      phone: (data.phone || 'Ext. ').trim(),
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

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('hitoms_departments_purged_requested_v4');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { department: newDept } })
      );
    }

    return newDept;
  }

  public async bulkCreateDepartments(
    items: Array<{
      code: string;
      name: string;
      building?: string;
      floor?: string;
      locationDescription?: string;
      headOfDepartment?: string;
      phone?: string;
      isEmergency?: boolean;
    }>,
    currentUser?: User | null
  ): Promise<{ created: Department[]; count: number }> {
    const created: Department[] = [];
    const existing = await this.getDepartments();
    const existingCodes = new Set(existing.map((d) => (d.code || '').toUpperCase()));
    const existingNames = new Set(existing.map((d) => (d.name || '').trim().toLowerCase()));
    const now = new Date().toISOString();

    for (const item of items) {
      if (!item.name || !item.code) continue;
      const codeClean = (item.code || '').trim().toUpperCase();
      const nameClean = (item.name || '').trim();
      if (!codeClean || !nameClean) continue;
      const nameKey = nameClean.toLowerCase();
      if (existingCodes.has(codeClean) || existingNames.has(nameKey)) continue;

      const locDesc = (item.locationDescription || '').trim();
      const bldg = (item.building || (locDesc ? locDesc : 'Main Hospital Complex')).trim();
      const flr = (item.floor || '').trim();

      const newDept: Department = {
        id: `dept-${generateUUID().substring(0, 8)}`,
        code: codeClean,
        name: nameClean,
        building: bldg,
        floor: flr,
        locationDescription: locDesc || (flr ? `${bldg}, ${flr}` : bldg),
        headOfDepartment: (item.headOfDepartment || '').trim(),
        phone: (item.phone || 'Ext. ').trim(),
        isEmergency: Boolean(item.isEmergency),
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'PENDING_SYNC',
        _syncVersion: 1,
        _lastSyncedAt: null,
        _deviceId: getDeviceId(),
      };

      await putToStore('departments', newDept);
      await syncService.enqueueOperation('departments', newDept.id, 'CREATE', newDept);
      existingCodes.add(codeClean);
      existingNames.add(nameKey);
      created.push(newDept);
    }

    await auditService.logAction('BULK_CREATE_DEPARTMENTS', 'Departments', 'BULK_IMPORT', null, {
      totalImported: created.length,
      importedBy: currentUser?.fullName || 'Super Admin',
      codes: created.map((d) => d.code),
    });

    if (created.length > 0 && typeof window !== 'undefined') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('hitoms_departments_purged_requested_v4');
      }
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { count: created.length } })
      );
    }

    return { created, count: created.length };
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { department: updated } })
      );
    }

    return updated;
  }

  public async deleteDepartment(id: string, currentUser?: User | null): Promise<void> {
    const existing = await this.getDepartmentById(id);
    if (!existing) return;

    recordTombstone('departments', id);
    await deleteFromStore('departments', id);

    // Direct proactive Firestore deletion if online
    if (isFirebaseConfigured() && firebaseClients.firestore) {
      import('firebase/firestore').then(({ doc, deleteDoc }) => {
        deleteDoc(doc(firebaseClients.firestore!, 'departments', id)).catch(() => {});
      }).catch(() => {});
    }

    await auditService.logAction('DELETE_DEPARTMENT', 'Departments', id, existing, {
      code: existing.code,
      name: existing.name,
      deletedBy: currentUser?.fullName || 'Super Admin',
    });

    await syncService.enqueueOperation('departments', id, 'DELETE', { id, name: existing.name });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { deletedId: id } })
      );
    }
  }

  public async deleteAllDepartments(currentUser?: User | null): Promise<number> {
    const existing = await this.getDepartments();
    const count = existing.length;

    // 1. Record tombstones for all existing departments so background sync never resurrects them
    for (const d of existing) {
      if (d.id) {
        recordTombstone('departments', d.id);
      }
    }

    // 2. Clear local IndexedDB store
    await clearStore('departments');

    // 3. Clear any queued department operations
    try {
      const queue = await getAllFromStore<any>('syncQueue');
      const filteredQueue = (queue || []).filter((q) => q.entityType !== 'departments');
      await clearStore('syncQueue');
      if (filteredQueue.length > 0) {
        await putBatchToStore('syncQueue', filteredQueue);
      }
    } catch (e) {}

    // 4. Proactively delete all department documents from Cloud Firestore
    try {
      if (isFirebaseConfigured() && firebaseClients.firestore) {
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
      }
    } catch (e: any) {
      console.warn('[DepartmentService] Firestore purge notice:', e?.message || e);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hitoms_departments_purged_requested_v4', 'true');
    }

    try {
      fetch('/api/purge-all-departments', { method: 'POST' }).catch(() => {});
    } catch (e) {}

    await auditService.logAction('DELETE_ALL_DEPARTMENTS', 'Departments', 'PURGE_ALL', null, {
      totalDeleted: count,
      deletedBy: currentUser?.fullName || 'Super Admin',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hitoms_departments_updated', { detail: { purgeAll: true, count } })
      );
    }

    return count;
  }
}

export const departmentService = new DepartmentService();
