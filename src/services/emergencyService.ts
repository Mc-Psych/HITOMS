import { type EmergencyBroadcastAlert, type User, type HospitalSystem, type SystemOperationalStatus } from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  STORE_NAMES,
  generateUUID,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { systemNotificationRingService } from './ticketSoundService';
import { syncService } from './syncService';

export interface QuickTriggerPreset {
  id: string; // 'CODE_BLUE_IT', 'EHR_DOWNTIME', 'CODE_RED_NETWORK', 'CYBER_LOCKDOWN'
  codeType: 'CODE_BLUE_IT' | 'CODE_RED_NETWORK' | 'EHR_DOWNTIME' | 'CYBER_LOCKDOWN' | 'GENERAL_EMERGENCY';
  badgeTitle: string;
  subTitle: string;
  description: string;
  defaultTitle: string;
  defaultMessage: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  targetSystemId?: string; // Tied Hospital System ID (e.g. 'sys-lhims')
  targetSystemName?: string; // Display name of tied system
  autoSetSystemStatus?: SystemOperationalStatus; // Status to set immediately (defaults to 'Down')
}

export const DEFAULT_QUICK_TRIGGERS: QuickTriggerPreset[] = [
  {
    id: 'EHR_DOWNTIME',
    codeType: 'EHR_DOWNTIME',
    badgeTitle: 'LHIMS DOWNTIME',
    subTitle: 'Offline Paper Chart Protocol',
    description: 'Notifies all clinical ward staff to switch to offline paper patient chart logging procedures due to unexpected LHIMS Electronic Health Record outage.',
    defaultTitle: '🚨 LHIMS DOWNTIME PROTOCOL ACTIVE: Switch to Paper Charts',
    defaultMessage: 'LHIMS (Hospital Information Management System) is currently experiencing unexpected downtime. All ward and clinical staff must switch to physical downtime paper charts immediately.',
    severity: 'CRITICAL',
    targetSystemId: 'sys-lhims',
    targetSystemName: 'LHIMS (Hospital Information Management System)',
    autoSetSystemStatus: 'Down',
  },
  {
    id: 'CODE_BLUE_IT',
    codeType: 'CODE_BLUE_IT',
    badgeTitle: 'CODE BLUE IT',
    subTitle: 'ICU / OT Rapid Dispatch',
    description: 'Dispatches immediate IT engineer rapid response to Intensive Care Units, Emergency Department, or Operating Theaters for patient-monitoring hardware failures.',
    defaultTitle: '🚨 CODE BLUE IT: Rapid Response Dispatched to ICU / ER',
    defaultMessage: 'Critical patient monitoring or surgical telemetry system issue reported. On-call IT engineer dispatched immediately.',
    severity: 'CRITICAL',
    targetSystemId: 'sys-quixmo',
    targetSystemName: 'Quixmo Pharmacy & Ward Telemetry Suite',
    autoSetSystemStatus: 'Down',
  },
  {
    id: 'CODE_RED_NETWORK',
    codeType: 'CODE_RED_NETWORK',
    badgeTitle: 'NETWORK / PACS OUTAGE',
    subTitle: 'Starlink & Gateway Outage',
    description: 'Alerts hospital departments of core network or internet gateway outage, isolating critical LAN systems.',
    defaultTitle: '⚠️ STARLINK NETWORK OUTAGE: Core Gateway Down',
    defaultMessage: 'Core network uplink / Starlink gateway is down. Offline LAN operations active.',
    severity: 'HIGH',
    targetSystemId: 'sys-starlink',
    targetSystemName: 'Starlink High-Performance Gateway',
    autoSetSystemStatus: 'Down',
  },
  {
    id: 'CYBER_LOCKDOWN',
    codeType: 'CYBER_LOCKDOWN',
    badgeTitle: 'CYBER LOCKDOWN',
    subTitle: 'Security Isolation',
    description: 'Isolates non-essential subnet VLANs and financial gateways in response to suspected ransomware or security incidents.',
    defaultTitle: '🔒 CYBERSECURITY ISOLATION LOCKDOWN IN EFFECT',
    defaultMessage: 'Precautionary VLAN isolation active. Disconnect non-critical external USB devices and log out of external web portals.',
    severity: 'CRITICAL',
    targetSystemId: 'sys-quickbooks',
    targetSystemName: 'QuickBooks Enterprise',
    autoSetSystemStatus: 'Down',
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
      targetSystemId?: string;
      targetSystemName?: string;
      autoSetSystemStatus?: SystemOperationalStatus;
    },
    user: User
  ): Promise<EmergencyBroadcastAlert> {
    // 1. Resolve tied system if not directly supplied
    let systemIdToUpdate = data.targetSystemId;
    let targetSystemName: string | undefined;
    let autoStatus: SystemOperationalStatus = data.autoSetSystemStatus || 'Down';
    let previousStatus: SystemOperationalStatus | undefined;

    if (!systemIdToUpdate) {
      const presets = await this.getQuickTriggers();
      const match = presets.find((p) => p.codeType === data.codeType || data.title.toLowerCase().includes(p.badgeTitle.toLowerCase()));
      if (match?.targetSystemId) {
        systemIdToUpdate = match.targetSystemId;
        targetSystemName = match.targetSystemName;
        if (match.autoSetSystemStatus) {
          autoStatus = match.autoSetSystemStatus;
        }
      }
    }

    // 2. Fetch all hospital systems from store and match target system
    try {
      const allSystems = await getAllFromStore<HospitalSystem>('hospitalSystems');
      let targetSys: HospitalSystem | undefined;

      if (systemIdToUpdate) {
        targetSys = allSystems.find((s) => s.id === systemIdToUpdate);
      }

      // Strong fallbacks for core emergency codes
      if (!targetSys) {
        if (
          data.codeType === 'EHR_DOWNTIME' ||
          data.title.toLowerCase().includes('lhims') ||
          data.message.toLowerCase().includes('lhims')
        ) {
          targetSys = allSystems.find(
            (s) => s.id === 'sys-lhims' || s.systemName.toLowerCase().includes('lhims')
          );
        } else if (
          data.codeType === 'CODE_RED_NETWORK' ||
          data.title.toLowerCase().includes('network') ||
          data.title.toLowerCase().includes('starlink')
        ) {
          targetSys = allSystems.find(
            (s) => s.id === 'sys-starlink' || s.systemName.toLowerCase().includes('starlink') || s.systemName.toLowerCase().includes('network')
          );
        } else if (data.codeType === 'CODE_BLUE_IT') {
          targetSys = allSystems.find(
            (s) => s.id === 'sys-quixmo' || s.systemName.toLowerCase().includes('quixmo') || s.systemName.toLowerCase().includes('telemetry')
          );
        } else if (data.codeType === 'CYBER_LOCKDOWN') {
          targetSys = allSystems.find(
            (s) => s.id === 'sys-quickbooks' || s.systemName.toLowerCase().includes('quickbooks')
          );
        }
      }

      if (targetSys) {
        previousStatus = targetSys.status;
        targetSystemName = targetSys.systemName;
        systemIdToUpdate = targetSys.id;

        const now = new Date().toISOString();
        const updatedSys: HospitalSystem = {
          ...targetSys,
          status: autoStatus,
          statusMessage: `🚨 EMERGENCY TRIGGER ACTIVE: ${data.title} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
          lastChecked: now,
          updatedAt: now,
          _syncStatus: 'PENDING_SYNC',
        };

        await putToStore('hospitalSystems', updatedSys);
        await syncService.enqueueOperation('hospitalSystems', updatedSys.id, 'UPDATE', updatedSys);

        await auditService.logAction(
          'EMERGENCY_SYSTEM_STATUS_CHANGE',
          'Hospital Systems',
          updatedSys.id,
          previousStatus,
          `${updatedSys.systemName} status immediately updated to "${autoStatus}" by Emergency Trigger: ${data.title}`
        );

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('hitoms_systems_updated', {
              detail: { systemId: updatedSys.id, status: autoStatus, title: data.title },
            })
          );
        }
      }
    } catch (err) {
      console.error('[EmergencyService] Error immediately updating tied hospital system status:', err);
    }

    const alert: EmergencyBroadcastAlert = {
      id: generateUUID(),
      codeType: data.codeType,
      title: data.title,
      message: data.message,
      severity: data.severity,
      targetUnits: data.targetUnits && data.targetUnits.length > 0 ? data.targetUnits : ['ALL'],
      targetSystemId: systemIdToUpdate,
      targetSystemName,
      previousSystemStatus: previousStatus,
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
      { codeType: data.codeType, title: data.title, message: data.message, tiedSystem: targetSystemName || 'None' }
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

        // If this alert was tied to a hospital system, restore its status!
        if (target.targetSystemId) {
          try {
            const allSystems = await getAllFromStore<HospitalSystem>('hospitalSystems');
            const tiedSys = allSystems.find((s) => s.id === target.targetSystemId);
            if (tiedSys) {
              const now = new Date().toISOString();
              const restoredStatus: SystemOperationalStatus = target.previousSystemStatus || 'Operational';
              const restoredSys: HospitalSystem = {
                ...tiedSys,
                status: restoredStatus,
                statusMessage: undefined,
                lastChecked: now,
                updatedAt: now,
                _syncStatus: 'PENDING_SYNC',
              };

              await putToStore('hospitalSystems', restoredSys);
              await syncService.enqueueOperation('hospitalSystems', restoredSys.id, 'UPDATE', restoredSys);

              await auditService.logAction(
                'RESTORE_SYSTEM_STATUS_EMERGENCY_RESOLVED',
                'Hospital Systems',
                restoredSys.id,
                tiedSys.status,
                `${restoredSys.systemName} status restored to "${restoredStatus}" upon resolving emergency alert ${target.title}`
              );

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('hitoms_systems_updated', {
                    detail: { systemId: restoredSys.id, status: restoredStatus, restored: true },
                  })
                );
              }
            }
          } catch (e) {
            console.error('[EmergencyService] Failed to restore tied system status on resolve:', e);
          }
        }

        await auditService.logAction(
          'EMERGENCY_BROADCAST_RESOLVED',
          'EMERGENCY',
          alertId,
          { isActive: true },
          { isActive: false, tiedSystem: target.targetSystemName || 'None' }
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
        return record.triggers.map((t: QuickTriggerPreset) => {
          const defaultMatch = DEFAULT_QUICK_TRIGGERS.find(
            (d) => d.id === t.id || d.codeType === t.codeType
          );
          return {
            ...t,
            targetSystemId: t.targetSystemId || defaultMatch?.targetSystemId,
            targetSystemName: t.targetSystemName || defaultMatch?.targetSystemName,
            autoSetSystemStatus: t.autoSetSystemStatus || defaultMatch?.autoSetSystemStatus || 'Down',
          };
        });
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
