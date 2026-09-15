import {
  getFromStore,
  putToStore,
} from './localDatabaseService';
import { auditService } from './auditService';
import { type SystemSettings, type User } from '../types';

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
  public async getSettings(): Promise<SystemSettings> {
    try {
      const stored = await getFromStore<SystemSettings>('settings', 'main');
      if (stored) return stored;
      await putToStore('settings', DEFAULT_SYSTEM_SETTINGS);
      return DEFAULT_SYSTEM_SETTINGS;
    } catch {
      return DEFAULT_SYSTEM_SETTINGS;
    }
  }

  public async updateSettings(
    updates: Partial<SystemSettings>,
    actor: User
  ): Promise<SystemSettings> {
    const allowedRoles = ['SUPER_ADMIN'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error('Access Denied: Only Super Administrators can update facility configuration and branding.');
    }

    const current = await this.getSettings();
    const updated: SystemSettings = {
      ...current,
      ...updates,
      id: 'main',
    };

    await putToStore('settings', updated);
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
