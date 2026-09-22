import {
  getFromStore,
  putToStore,
} from './localDatabaseService';
import { auditService } from './auditService';
import { type SystemSettings, type User } from '../types';

export const LOCAL_STORAGE_SETTINGS_KEY = 'hitoms_facility_settings';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'main',
  hospitalName: 'St. Jude General Hospital',
  hospitalLogo: '',
  hospitalLanUrl: 'http://hitoms.local',
  contactEmail: 'it-support@stjude-hospital.local',
  contactPhone: '+1 (555) 234-5678',
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
  lastSuccessfulSync: null,
};

class SettingsService {
  /**
   * Get settings synchronously from localStorage cache if available
   */
  public getSettingsSync(): SystemSettings {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(cached) };
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
        // Cache to localStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(stored));
        } catch {
          // ignore
        }
        return { ...DEFAULT_SYSTEM_SETTINGS, ...stored };
      }

      // Check localStorage if not in IndexedDB
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        const parsed = { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(cached) };
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

