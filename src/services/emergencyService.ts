import { type EmergencyBroadcastAlert, type User, type Role } from '../types';
import {
  getAllFromStore,
  putToStore,
  STORE_NAMES,
  generateUUID,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { systemNotificationRingService } from './ticketSoundService';

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
}

export const emergencyService = new EmergencyService();
