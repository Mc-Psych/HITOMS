import {
  type Ticket,
  type TicketPriority,
  type TicketCategory,
  type TicketStatus,
  type TicketComment,
  type TicketResolution,
  type Attachment,
  type User,
  type AiTriageResult,
} from '../types';
import {
  getAllFromStore,
  getFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
  getNextTicketNumber,
  getDeviceId,
} from './localDatabaseService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { syncService } from './syncService';
import { ticketSoundService } from './ticketSoundService';

class TicketService {
  public async getTickets(): Promise<Ticket[]> {
    const tickets = await getAllFromStore<Ticket>('tickets');
    return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getTicketById(id: string): Promise<Ticket | null> {
    return getFromStore<Ticket>('tickets', id);
  }

  public async createTicket(
    data: {
      title: string;
      description: string;
      category: TicketCategory;
      subcategory?: string;
      priority: TicketPriority;
      department: string;
      location: string;
      assetId?: string | null;
      attachments?: Attachment[];
      isGeneralIssue?: boolean;
      aiTriage?: AiTriageResult | null;
    },
    user: User
  ): Promise<Ticket> {
    const id = generateUUID();
    const ticketNumber = await getNextTicketNumber();
    const now = new Date().toISOString();

    // SLA calculation based on priority
    const slaHoursMap: Record<TicketPriority, { response: number; resolution: number }> = {
      Critical: { response: 1, resolution: 4 },
      High: { response: 2, resolution: 8 },
      Medium: { response: 4, resolution: 24 },
      Low: { response: 8, resolution: 72 },
    };
    const hours = slaHoursMap[data.priority] || slaHoursMap.Medium;
    const responseDue = new Date(Date.now() + hours.response * 60 * 60 * 1000).toISOString();
    const resolutionDue = new Date(Date.now() + hours.resolution * 60 * 60 * 1000).toISOString();

    const newTicket: Ticket = {
      id,
      ticketNumber,
      title: data.title,
      description: data.description,
      category: data.category,
      subcategory: data.subcategory,
      priority: data.priority,
      status: 'New',
      department: data.department,
      location: data.location,
      isGeneralIssue: Boolean(data.isGeneralIssue),
      reportedBy: {
        uid: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        department: user.department,
      },
      assignedTo: null,
      assetId: data.assetId || null,
      attachments: data.attachments || [],
      comments: [],
      resolution: null,
      confirmationRating: null,
      aiTriage: data.aiTriage || null,
      sla: {
        responseDue,
        resolutionDue,
        isBreached: false,
      },
      createdAt: now,
      updatedAt: now,
      _syncStatus: 'PENDING_SYNC',
      _syncVersion: 1,
      _lastSyncedAt: null,
      _deviceId: getDeviceId(),
    };

    await putToStore('tickets', newTicket);

    // Audit and Notification
    await auditService.logAction('CREATE_TICKET', 'Tickets', id, null, {
      ticketNumber,
      title: data.title,
      priority: data.priority,
      department: data.department,
    });

    await notificationService.notify(
      `New Ticket: ${ticketNumber}`,
      `[${data.priority}] ${data.title} reported by ${user.fullName} (${data.department})`,
      data.priority === 'Critical' ? 'error' : 'info',
      'Tickets',
      'ALL',
      id
    );

    // Enqueue for cloud sync
    await syncService.enqueueOperation('tickets', id, 'CREATE', newTicket);

    // Trigger phone/PC notification bell ring for IT Unit & Super Admin
    try {
      await ticketSoundService.ringNewTicketAlert(newTicket, user);
    } catch (err) {
      console.warn('[TicketService] Failed to trigger sound alert:', err);
    }

    return newTicket;
  }

  public async assignTicket(
    ticketId: string,
    technician: { uid: string; name: string; email: string },
    actor: User
  ): Promise<Ticket> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error('Unauthorized: Only IT Administrators and Super Admins can assign tickets to technicians.');
    }

    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const oldAssigned = ticket.assignedTo;
    const now = new Date().toISOString();

    ticket.assignedTo = technician;
    ticket.status = ticket.status === 'New' ? 'Assigned' : ticket.status;
    ticket.assignedAt = now;
    ticket.updatedAt = now;
    ticket._syncStatus = 'PENDING_SYNC';
    ticket._syncVersion = (ticket._syncVersion || 1) + 1;

    await putToStore('tickets', ticket);

    await auditService.logAction('ASSIGN_TICKET', 'Tickets', ticket.id, oldAssigned, technician);

    await notificationService.notify(
      `Ticket Assigned: ${ticket.ticketNumber}`,
      `Assigned to ${technician.name} by ${actor.fullName}`,
      'info',
      'Tickets',
      technician.uid,
      ticket.id
    );

    await syncService.enqueueOperation('tickets', ticket.id, 'UPDATE', ticket);
    return ticket;
  }

  public async updateStatus(ticketId: string, status: TicketStatus, actor: User): Promise<Ticket> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error('Access Denied: Clinical and general staff cannot change ticket status. Only designated IT officers and administrators can update ticket lifecycle states.');
    }

    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const oldStatus = ticket.status;
    const now = new Date().toISOString();

    ticket.status = status;
    ticket.updatedAt = now;
    if (status === 'Closed') {
      ticket.closedAt = now;
    } else if (status === 'Reopened') {
      ticket.reopenedAt = now;
    }
    ticket._syncStatus = 'PENDING_SYNC';
    ticket._syncVersion = (ticket._syncVersion || 1) + 1;

    await putToStore('tickets', ticket);

    await auditService.logAction('UPDATE_TICKET_STATUS', 'Tickets', ticket.id, oldStatus, status);

    await notificationService.notify(
      `Ticket ${ticket.ticketNumber} status changed`,
      `Status updated from ${oldStatus} to ${status} by ${actor.fullName}`,
      'info',
      'Tickets',
      ticket.reportedBy.uid,
      ticket.id
    );

    await syncService.enqueueOperation('tickets', ticket.id, 'UPDATE', ticket);
    return ticket;
  }

  public async resolveTicket(
    ticketId: string,
    resolutionData: {
      description: string;
      workPerformed: string;
      preventiveRecommendation?: string;
    },
    actor: User
  ): Promise<Ticket> {
    const allowedRoles = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error('Access Denied: Only IT support officers and engineers can submit resolution reports.');
    }

    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const now = new Date().toISOString();
    const resolution: TicketResolution = {
      description: resolutionData.description,
      workPerformed: resolutionData.workPerformed,
      preventiveRecommendation: resolutionData.preventiveRecommendation,
      resolvedBy: actor.fullName,
      resolvedAt: now,
    };

    ticket.resolution = resolution;
    ticket.status = 'Resolved';
    ticket.resolvedAt = now;
    ticket.updatedAt = now;
    ticket._syncStatus = 'PENDING_SYNC';
    ticket._syncVersion = (ticket._syncVersion || 1) + 1;

    await putToStore('tickets', ticket);

    await auditService.logAction('RESOLVE_TICKET', 'Tickets', ticket.id, null, resolution);

    await notificationService.notify(
      `Ticket Resolved: ${ticket.ticketNumber}`,
      `Resolved by ${actor.fullName}. Solution: ${(resolutionData.description || 'Marked resolved').substring(0, 80)}...`,
      'success',
      'Tickets',
      ticket.reportedBy.uid,
      ticket.id
    );

    await syncService.enqueueOperation('tickets', ticket.id, 'UPDATE', ticket);
    return ticket;
  }

  public async closeTicketWithRating(
    ticketId: string,
    rating: number,
    feedback: string,
    actor: User
  ): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const isGeneral = Boolean(ticket.isGeneralIssue);
    const isSameDept = actor.department.toLowerCase() === ticket.department.toLowerCase();
    const isReporter = actor.id === ticket.reportedBy.uid;
    const isSuper = actor.role === 'SUPER_ADMIN';

    if (!isGeneral && !isSameDept && !isReporter && !isSuper) {
      throw new Error(
        `Access Denied: Only staff from the reporting unit (${ticket.department}) can confirm this resolution and rate IT service.`
      );
    }

    const now = new Date().toISOString();
    ticket.status = 'Closed';
    ticket.closedAt = now;
    ticket.updatedAt = now;
    ticket.confirmationRating = {
      rating,
      feedback: feedback || '',
      confirmedBy: {
        uid: actor.id,
        name: actor.fullName,
        department: actor.department,
      },
      confirmedAt: now,
    };
    ticket._syncStatus = 'PENDING_SYNC';
    ticket._syncVersion = (ticket._syncVersion || 1) + 1;

    await putToStore('tickets', ticket);

    await auditService.logAction('CONFIRM_AND_CLOSE_TICKET', 'Tickets', ticket.id, null, {
      rating,
      feedback,
      confirmedBy: actor.fullName,
      department: actor.department,
      isGeneralIssue: ticket.isGeneralIssue,
    });

    if (ticket.assignedTo) {
      await notificationService.notify(
        `Ticket Closed & Rated: ${ticket.ticketNumber}`,
        `Rated ${rating}/5 by ${actor.fullName} (${actor.department}). Feedback: ${feedback || 'Resolution confirmed.'}`,
        'info',
        'Tickets',
        ticket.assignedTo.uid,
        ticket.id
      );
    }

    await syncService.enqueueOperation('tickets', ticket.id, 'UPDATE', ticket);
    return ticket;
  }

  public async addComment(
    ticketId: string,
    commentText: string,
    user: User,
    attachment?: Attachment
  ): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const comment: TicketComment = {
      id: generateUUID(),
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      comment: commentText,
      createdAt: new Date().toISOString(),
      attachment,
    };

    ticket.comments.push(comment);
    ticket.updatedAt = new Date().toISOString();
    ticket._syncStatus = 'PENDING_SYNC';
    ticket._syncVersion = (ticket._syncVersion || 1) + 1;

    await putToStore('tickets', ticket);

    await auditService.logAction('ADD_TICKET_COMMENT', 'Tickets', ticket.id, null, {
      commentId: comment.id,
      author: user.fullName,
    });

    await syncService.enqueueOperation('tickets', ticket.id, 'UPDATE', ticket);
    return ticket;
  }
}

export const ticketService = new TicketService();
