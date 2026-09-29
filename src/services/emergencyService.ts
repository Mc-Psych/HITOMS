import { type EmergencyBroadcastAlert, type User } from '../types';
import {
  getAllFromStore,
  putToStore,
  STORE_NAMES,
  generateUUID,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { systemNotificationRingService } from './ticketSoundService';

export interface QuickTriggerPreset {
  id: string; // 'CODE_BLUE_IT', 'EHR_DOWNTIME', 'CODE_RED_NETWORK', 'CYBER_LOCKDOWN'
  codeType: 'CODE_BLUE_IT' | 'CODE_RED_NETWORK' | 'EHR_DOWNTIME' | 'CYBER_LOCKDOWN' | 'GENERAL_EMERGENCY';
  badgeTitle: string;
  subTitle: string;
  description: string;
  defaultTitle: string;
  defaultMessage: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
}

export const DEFAULT_QUICK_TRIGGERS: QuickTriggerPreset[] = [
  {
    id: 'CODE_BLUE_IT',
    codeType: 'CODE_BLUE_IT',
    badgeTitle: 'CODE BLUE IT',
    subTitle: 'ICU / OT Rapid Dispatch',
    description: 'Dispatches immediate IT engineer rapid response to Intensive Care Units, Emergency Department, or Operating Theaters for patient-monitoring hardware failures.',
    defaultTitle: '🚨 CODE BLUE IT: Rapid Response Dispatched to ICU / ER',
    defaultMessage: 'Critical patient monitoring or surgical telemetry system issue reported. On-call IT engineer dispatched immediately.',
    severity: 'CRITICAL',
  },
  {
    id: 'EHR_DOWNTIME',
    codeType: 'EHR_DOWNTIME',
    badgeTitle: 'EHR DOWNTIME',
    subTitle: 'Paper Chart Protocol',
    description: 'Notifies all ward staff to switch to offline paper patient chart logging procedures due to unexpected Electronic Health Record database outage.',
    defaultTitle: '🟧 EHR DOWNTIME PROTOCOL ACTIVE: Switch to Paper Charts',
    defaultMessage: 'Electronic Health Record database is undergoing emergency maintenance. Clinical ward staff must switch to offline paper logging procedures.',
    severity: 'HIGH',
  },
  {
    id: 'CODE_RED_NETWORK',
    codeType: 'CODE_RED_NETWORK',
    badgeTitle: 'PACS / NETWORK OUTAGE',
    subTitle: 'Radiology Gateway',
    description: 'Alerts Radiology and ER departments of imaging gateway or core fiber switch failure, redirecting CT/MRI scans to local USB image stores.',
    defaultTitle: '⚠️ PACS Imaging Gateway Network Degradation',
    defaultMessage: 'Radiology PACS server link degraded. Use local DICOM viewer storage for urgent CT / Ultrasound imaging.',
    severity: 'HIGH',
  },
  {
    id: 'CYBER_LOCKDOWN',
    codeType: 'CYBER_LOCKDOWN',
    badgeTitle: 'CYBER LOCKDOWN',
    subTitle: 'Security Isolation',
    description: 'Isolates non-essential subnet VLANs in response to suspected ransomware or unauthorized external network access attempts.',
    defaultTitle: '🔒 CYBERSECURITY ISOLATION LOCKDOWN IN EFFECT',
    defaultMessage: 'Precautionary VLAN isolation active. Disconnect non-critical external USB devices and log out of external web portals.',
    severity: 'CRITICAL',
  },
];

class EmergencyService {
  public async getActiveBroadcasts(): Promise<EmergencyBroadcastAlert[]> {
    try {
      const alerts = await getAllFromStore<EmergencyBroadcastAlert>(STORE_NAMES.emergencyBroadcasts);
      return alerts.filter((a) => a.isActive).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.error('[EmergencyService] Failed to load broadcasts:', err);
      return [];
    }
  }

  public async createBroadcast(
    data: {
      codeType: 'CODE_BLUE_IT' | 'CODE_RED_NETWORK' | 'EHR_DOWNTIME' | 'CYBER_LOCKDOWN' | 'GENERAL_EMERGENCY';
      title: string;
      message: string;
      severity: 'CRITICAL' | 'HIGH' | 'WARNING';
      targetUnits?: string[];
    },
    user: User
  ): Promise<EmergencyBroadcastAlert> {
    const alert: EmergencyBroadcastAlert = {
      id: generateUUID(),
      codeType: data.codeType,
      title: data.title,
      message: data.message,
      severity: data.severity,
      targetUnits: data.targetUnits && data.targetUnits.length > 0 ? data.targetUnits : ['ALL'],
      issuedBy: {
        uid: user.id,
        name: user.fullName,
        role: user.role,
      },
      isActive: true,
      createdAt: new Date().toISOString(),
      acknowledgedByUsers: [],
    };

    await putToStore(STORE_NAMES.emergencyBroadcasts, alert);

    // Trigger system notification ring for alert (rings siren & delivers background notification even if app closed)
    try {
      await systemNotificationRingService.ringEmergencyAlert(
        data.title,
        data.message,
        data.severity
      );
    } catch (e) {
      console.warn('[EmergencyService] Failed to ring alert:', e);
    }

    // Audit log
    await auditService.logAction(
      'EMERGENCY_BROADCAST_CREATED',
      'EMERGENCY',
      alert.id,
      null,
      { codeType: data.codeType, title: data.title, message: data.message }
    );

    // Also push a high priority notification
    await notificationService.notify(
      `🚨 ${data.title}`,
      data.message,
      'error',
      'EMERGENCY',
      'ALL',
      alert.id,
      {
        targetType: 'ALL',
        senderName: user.fullName,
        senderRole: user.role,
      }
    );

    return alert;
  }

  public async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      const alerts = await getAllFromStore<EmergencyBroadcastAlert>(STORE_NAMES.emergencyBroadcasts);
      const target = alerts.find((a) => a.id === alertId);
      if (target) {
        const acks = new Set(target.acknowledgedByUsers || []);
        acks.add(userId);
        target.acknowledgedByUsers = Array.from(acks);
        await putToStore(STORE_NAMES.emergencyBroadcasts, target);
      }
    } catch (err) {
      console.error('[EmergencyService] Failed to acknowledge alert:', err);
    }
  }

  public async resolveBroadcast(alertId: string, user: User): Promise<void> {
    try {
      const alerts = await getAllFromStore<EmergencyBroadcastAlert>(STORE_NAMES.emergencyBroadcasts);
      const target = alerts.find((a) => a.id === alertId);
      if (target) {
        target.isActive = false;
        await putToStore(STORE_NAMES.emergencyBroadcasts, target);

        await auditService.logAction(
          'EMERGENCY_BROADCAST_RESOLVED',
          'EMERGENCY',
          alertId,
          { isActive: true },
          { isActive: false }
        );
      }
    } catch (err) {
      console.error('[EmergencyService] Failed to resolve broadcast:', err);
    }
  }

  // --- QUICK EMERGENCY TRIGGERS PRESET MANAGEMENT ---
  public async getQuickTriggers(): Promise<QuickTriggerPreset[]> {
    try {
      const settings = await getAllFromStore<any>(STORE_NAMES.settings);
      const record = settings.find((s) => s.id === 'emergency_quick_triggers');
      if (record && Array.isArray(record.triggers) && record.triggers.length > 0) {
        return record.triggers;
      }
      return DEFAULT_QUICK_TRIGGERS;
    } catch (err) {
      console.error('[EmergencyService] Failed to fetch quick triggers:', err);
      return DEFAULT_QUICK_TRIGGERS;
    }
  }

  public async saveQuickTrigger(
    updatedPreset: QuickTriggerPreset,
    user: User
  ): Promise<QuickTriggerPreset[]> {
    try {
      const current = await this.getQuickTriggers();
      const index = current.findIndex((p) => p.id === updatedPreset.id);
      let newTriggers: QuickTriggerPreset[] = [];
      if (index >= 0) {
        newTriggers = [...current];
        newTriggers[index] = updatedPreset;
      } else {
        newTriggers = [...current, updatedPreset];
      }

      await putToStore(STORE_NAMES.settings, {
        id: 'emergency_quick_triggers',
        triggers: newTriggers,
        updatedAt: new Date().toISOString(),
        updatedBy: user.fullName,
      });

      await auditService.logAction(
        'EDIT_EMERGENCY_TRIGGER_PRESET',
        'EMERGENCY',
        updatedPreset.id,
        null,
        `Quick emergency trigger "${updatedPreset.badgeTitle}" updated by ${user.fullName}`
      );

      return newTriggers;
    } catch (err) {
      console.error('[EmergencyService] Failed to save quick trigger preset:', err);
      return DEFAULT_QUICK_TRIGGERS;
    }
  }

  public async resetQuickTriggers(user: User): Promise<QuickTriggerPreset[]> {
    try {
      await putToStore(STORE_NAMES.settings, {
        id: 'emergency_quick_triggers',
        triggers: DEFAULT_QUICK_TRIGGERS,
        updatedAt: new Date().toISOString(),
        updatedBy: user.fullName,
      });

      await auditService.logAction(
        'RESET_EMERGENCY_TRIGGERS',
        'EMERGENCY',
        'emergency_quick_triggers',
        null,
        `Quick emergency triggers reset to factory default by ${user.fullName}`
      );

      return DEFAULT_QUICK_TRIGGERS;
    } catch (err) {
      console.error('[EmergencyService] Failed to reset quick triggers:', err);
      return DEFAULT_QUICK_TRIGGERS;
    }
  }
}

export const emergencyService = new EmergencyService();
