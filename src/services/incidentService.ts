import {
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
  type RootCauseAnalysis,
  type User,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  generateUUID,
  getNextIncidentNumber,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { syncService } from './syncService';

class IncidentService {
  public async getIncidents(): Promise<Incident[]> {
    const list = await getAllFromStore<Incident>('incidents');
    return list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  public async getIncidentById(id: string): Promise<Incident | null> {
    return getFromStore<Incident>('incidents', id);
  }

  public async reportIncident(
    data: {
      title: string;
      description: string;
      severity: IncidentSeverity;
      affectedSystems: string[];
      affectedDepartments: string[];
      assignedTeam: string;
      impact: string;
    },
    user: User
  ): Promise<Incident> {
    const id = generateUUID();
    const incidentNumber = await getNextIncidentNumber();
    const now = new Date().toISOString();

    const incident: Incident = {
      id,
      incidentNumber,
      title: data.title,
      description: data.description,
      severity: data.severity,
      affectedSystems: data.affectedSystems,
      affectedDepartments: data.affectedDepartments,
      startTime: now,
      detectedBy: user.fullName,
      assignedTeam: data.assignedTeam,
      status: 'Active',
      actionsTaken: [],
      impact: data.impact,
      timeline: [
        {
          timestamp: now,
          message: `Major incident declared with severity ${data.severity}. Affected systems: ${(data.affectedSystems || []).join(', ')}`,
          user: user.fullName,
        },
      ],
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('incidents', incident);

    await auditService.logAction('DECLARE_INCIDENT', 'Incidents', id, null, {
      incidentNumber,
      title: data.title,
      severity: data.severity,
    });

    await notificationService.notify(
      `CRITICAL INCIDENT: ${incidentNumber}`,
      `[${data.severity}] ${data.title}. Affecting: ${(data.affectedDepartments || []).join(', ')}`,
      'error',
      'Incidents',
      'ALL',
      id
    );

    await syncService.enqueueOperation('incidents', id, 'CREATE', incident);
    return incident;
  }

  public async addTimelineUpdate(
    id: string,
    message: string,
    user: User
  ): Promise<Incident> {
    const incident = await this.getIncidentById(id);
    if (!incident) throw new Error('Incident not found');

    const now = new Date().toISOString();
    incident.timeline.push({
      timestamp: now,
      message,
      user: user.fullName,
    });
    incident.actionsTaken.push(message);
    incident.updatedAt = now;
    incident._syncStatus = 'PENDING_SYNC';
    incident._syncVersion = (incident._syncVersion || 1) + 1;

    await putToStore('incidents', incident);
    await syncService.enqueueOperation('incidents', id, 'UPDATE', incident);
    return incident;
  }

  public async resolveIncident(
    id: string,
    resolution: string,
    rca: RootCauseAnalysis,
    user: User
  ): Promise<Incident> {
    const incident = await this.getIncidentById(id);
    if (!incident) throw new Error('Incident not found');

    const now = new Date().toISOString();
    incident.status = 'Resolved';
    incident.resolution = resolution;
    incident.resolvedAt = now;
    incident.rootCauseAnalysis = rca;
    incident.timeline.push({
      timestamp: now,
      message: `Incident resolved by ${user.fullName}. Root cause identified: ${rca.rootCause}`,
      user: user.fullName,
    });
    incident.updatedAt = now;
    incident._syncStatus = 'PENDING_SYNC';
    incident._syncVersion = (incident._syncVersion || 1) + 1;

    await putToStore('incidents', incident);

    await auditService.logAction('RESOLVE_INCIDENT', 'Incidents', id, null, {
      incidentNumber: incident.incidentNumber,
      rootCause: rca.rootCause,
      correctiveAction: rca.correctiveAction,
    });

    await notificationService.notify(
      `Incident Resolved: ${incident.incidentNumber}`,
      `Resolved by ${user.fullName}. Post-incident RCA completed.`,
      'success',
      'Incidents',
      'ALL',
      id
    );

    await syncService.enqueueOperation('incidents', id, 'UPDATE', incident);
    return incident;
  }
}

export const incidentService = new IncidentService();
