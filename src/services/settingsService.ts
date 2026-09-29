import {
  getFromStore,
  putToStore,
} from './localDatabaseService';
import { auditService } from './auditService';
import { type SystemSettings, type User } from '../types';

export const LOCAL_STORAGE_SETTINGS_KEY = 'hitoms_facility_settings';

export const ST_MARY_THERESA_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="none" stroke="%23047857" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="%23ffffff" stroke="%23dc2626" stroke-width="2"/><path d="M44 22 h12 v18 h18 v12 h-18 v22 h-12 v-22 h-18 v-12 h18 z" fill="%23dc2626"/><circle cx="50" cy="50" r="7" fill="%23047857"/><path d="M50 45 v10 M45 50 h10" stroke="#ffffff" stroke-width="2"/></svg>`;

export const ST_MARY_THERESA_LETTERHEAD_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 220" width="1200" height="220"><rect width="1200" height="220" fill="%23ffffff"/><g transform="translate(30, 15)"><circle cx="65" cy="65" r="58" fill="none" stroke="%23047857" stroke-width="5"/><circle cx="65" cy="65" r="48" fill="%23ffffff" stroke="%23dc2626" stroke-width="3"/><path d="M57 32 h16 v22 h22 v16 h-22 v26 h-16 v-26 h-22 v-16 h22 z" fill="%23dc2626"/><circle cx="65" cy="65" r="9" fill="%23047857"/><text x="65" y="21" font-family="sans-serif" font-size="6" font-weight="900" fill="%23047857" text-anchor="middle">CATHOLIC HEALTH SERVICE TRUST - GHANA</text><text x="65" y="117" font-family="sans-serif" font-size="5.5" font-weight="800" fill="%23047857" text-anchor="middle">(JASIKAN DIOCESE)</text></g><g transform="translate(175, 20)"><rect width="60" height="75" rx="6" fill="%231e293b" stroke="%230f172a" stroke-width="1.5"/><circle cx="30" cy="28" r="14" fill="%23f8fafc" opacity="0.9"/><path d="M12 62 c0 -12 8 -18 18 -18 s18 6 18 18 z" fill="%2338bdf8"/><text x="30" y="88" font-family="sans-serif" font-size="9" font-weight="900" fill="%230f172a" text-anchor="middle">ST. MARY THERESA</text><text x="30" y="99" font-family="sans-serif" font-size="8.5" font-weight="800" fill="%230f172a" text-anchor="middle">CATHOLIC HOSPITAL</text><text x="30" y="111" font-family="sans-serif" font-size="7" fill="%23475569" text-anchor="middle">DODI PAPASE, KADJEBI DISTRICT - OTI REGION</text></g><g transform="translate(1170, 45)" text-anchor="end"><text x="0" y="0" font-family="Georgia, serif" font-size="28" font-weight="700" font-style="italic" fill="%230f172a">St. Mary Theresa Catholic Hospital I.T Support Unit</text><text x="0" y="40" font-family="sans-serif" font-size="20" font-weight="600" fill="%231e293b">Tel: 055 272 2289</text><text x="0" y="75" font-family="sans-serif" font-size="20" font-weight="600" fill="%231d4ed8">E-mail: send2smthit@gmail.com</text></g><line x1="30" y1="185" x2="1170" y2="185" stroke="%230f172a" stroke-width="3"/></svg>`;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'main',
  hospitalName: 'St. Mary Theresa Catholic Hospital',
  hospitalLogo: ST_MARY_THERESA_LOGO,
  hospitalLetterheadImage: ST_MARY_THERESA_LETTERHEAD_IMAGE,
  letterheadSubTitle: 'St. Mary Theresa Catholic Hospital I.T Support Unit',
  letterheadAddressLine: 'DODI PAPASE, KADJEBI DISTRICT - OTI REGION',
  letterheadFooterText: 'ST. MARY THERESA CATHOLIC HOSPITAL — DEPARTMENT OF INFORMATION TECHNOLOGY',
  letterheadMode: 'DYNAMIC_HEADER',
  hospitalLanUrl: 'http://hitoms.local',
  contactEmail: 'send2smthit@gmail.com',
  contactPhone: '055 272 2289',
  emergencyExtension: 'Ext. 9911',
  address: '104 Healthcare Boulevard, Ward 4',
  regionOrDistrict: 'Highland Medical District',
  bedCapacity: 350,
  cloudSyncEnabled: true,
  autoSyncIntervalSec: 60,
  offlinePolicy: {
    allowOfflineLogin: true,
    maxOfflineHours: 72,
    allowOfflineTicketCreation: true,
    allowOfflineAssetModification: true,
    allowOfflineInventoryTx: true,
    allowOfflineAdmin: false,
  },
  slaRules: {
    Critical: { priority: 'Critical', responseHours: 0.5, resolutionHours: 2 },
    High: { priority: 'High', responseHours: 1, resolutionHours: 6 },
    Medium: { priority: 'Medium', responseHours: 4, resolutionHours: 24 },
    Low: { priority: 'Low', responseHours: 8, resolutionHours: 72 },
  },
  reNotificationIntervalMinutes: 30,
  ringToneDurationSeconds: 5,
  emergencyReNotificationMinutes: 15,
  lastSuccessfulSync: null,
};

function normalizeFacilitySettings(settings: SystemSettings): SystemSettings {
  if (!settings.hospitalName || settings.hospitalName.includes('St. Jude')) {
    return {
      ...settings,
      hospitalName: 'St. Mary Theresa Catholic Hospital',
      contactEmail: (!settings.contactEmail || settings.contactEmail.includes('stjude'))
        ? 'it-support@stmarytheresa-hospital.local'
        : settings.contactEmail,
    };
  }
  return settings;
}

class SettingsService {
  /**
   * Get settings synchronously from localStorage cache if available
   */
  public getSettingsSync(): SystemSettings {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        const parsed = normalizeFacilitySettings({ ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(cached) });
        return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SYSTEM_SETTINGS;
  }

  /**
   * Get settings asynchronously from IndexedDB or localStorage
   */
  public async getSettings(): Promise<SystemSettings> {
    try {
      let stored = await getFromStore<SystemSettings>('settings', 'main');
      if (!stored) {
        stored = await getFromStore<SystemSettings>('settings', 'app_settings');
      }

      if (stored) {
        const normalized = normalizeFacilitySettings({ ...DEFAULT_SYSTEM_SETTINGS, ...stored });
        if (stored.hospitalName && stored.hospitalName.includes('St. Jude')) {
          await putToStore('settings', { ...normalized, id: 'main' });
          await putToStore('settings', { ...normalized, id: 'app_settings' });
        }
        // Cache to localStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(normalized));
        } catch {
          // ignore
        }
        return normalized;
      }

      // Check localStorage if not in IndexedDB
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        const parsed = normalizeFacilitySettings({ ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(cached) });
        await putToStore('settings', { ...parsed, id: 'main' });
        await putToStore('settings', { ...parsed, id: 'app_settings' });
        return parsed;
      }

      // Save default settings
      await putToStore('settings', DEFAULT_SYSTEM_SETTINGS);
      await putToStore('settings', { ...DEFAULT_SYSTEM_SETTINGS, id: 'app_settings' });
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
      return DEFAULT_SYSTEM_SETTINGS;
    } catch {
      return this.getSettingsSync();
    }
  }

  public async updateSettings(
    updates: Partial<SystemSettings>,
    actor: User
  ): Promise<SystemSettings> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error('Access Denied: Only Administrators can update facility configuration and branding.');
    }

    const current = await this.getSettings();
    const updated: SystemSettings = {
      ...current,
      ...updates,
      id: 'main',
    };

    // Save to IndexedDB stores (both main and app_settings keys for compatibility)
    await putToStore('settings', updated);
    await putToStore('settings', { ...updated, id: 'app_settings' });

    // Enqueue for cloud synchronization to Firestore instantly
    try {
      const { syncService } = await import('./syncService');
      await syncService.enqueueOperation('settings', 'main', 'UPDATE', updated);
    } catch (syncErr) {
      console.warn('[SettingsService] Failed to enqueue settings update to syncService:', syncErr);
    }

    // Cache to localStorage for instant default availability
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[SettingsService] Failed to cache settings in localStorage:', e);
    }

    // Notify active listeners across tabs/components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hitoms_settings_updated', { detail: updated }));
    }

    await auditService.logAction(
      'UPDATE_SYSTEM_SETTINGS',
      'Administration',
      'main',
      current,
      updates
    );

    return updated;
  }
}

export const settingsService = new SettingsService();

