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
import { officerSpecialtyService } from './officerSpecialtyService';

class TicketService {
  public async getTickets(): Promise<Ticket[]> {
    const tickets = await getAllFromStore<Ticket>('tickets');
    return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getTicketById(id: string): Promise<Ticket | null> {
    return getFromStore<Ticket>('tickets', id);
  }

  /**
   * Determine the appropriate IT technician or IT Unit team to automatically assign an incoming ticket
   * based on officer monthly specialties roster (e.g. Officer 1 specialty is networking, so networking issues are auto-assigned to him).
   */
  public async determineAutoAssignee(
    category: TicketCategory,
    department?: string
  ): Promise<{
    uid: string;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    autoAssignedBySpecialty?: boolean;
    specialtyMatched?: TicketCategory;
    month?: string;
  }> {
    try {
      // 1. Check monthly specialties roster (e.g. Officer 1 specialty is networking)
      const specialtyMatch = await officerSpecialtyService.findOfficerForTicketCategory(category);
      if (specialtyMatch) {
        return {
          uid: specialtyMatch.user.id,
          name: specialtyMatch.user.fullName,
          email: specialtyMatch.user.email,
          phone: specialtyMatch.user.phone,
          department: specialtyMatch.user.department,
          autoAssignedBySpecialty: true,
          specialtyMatched: specialtyMatch.specialtyMatched,
          month: specialtyMatch.month,
        };
      }

      // 2. Fallback to active IT staff
      const allUsers = await getAllFromStore<User>('users');
      const itUsers = allUsers.filter(
        (u) =>
          u.status === 'Active' &&
          (u.role === 'SUPER_ADMIN' ||
            u.role === 'IT_ADMIN' ||
            u.role === 'IT_OFFICER' ||
            (u.department && u.department.toLowerCase().includes('it')))
      );

      if (itUsers.length > 0) {
        let selectedTech: User | undefined;

        switch (category) {
          case 'Network':
          case 'Internet':
            selectedTech =
              itUsers.find((u) => u.fullName.toLowerCase().includes('daniel') || u.jobTitle.toLowerCase().includes('network')) ||
              itUsers.find((u) => u.role === 'IT_OFFICER') ||
              itUsers.find((u) => u.role === 'IT_ADMIN');
            break;

          case 'Server':
          case 'Hospital System':
          case 'Security':
          case 'Email':
            selectedTech =
              itUsers.find((u) => u.role === 'SUPER_ADMIN') ||
              itUsers.find((u) => u.role === 'IT_ADMIN');
            break;

          case 'Hardware':
          case 'Printer':
          case 'Software':
          case 'Account/Login':
          default:
            selectedTech =
              itUsers.find((u) => u.role === 'IT_OFFICER') ||
              itUsers[0];
            break;
        }

        if (selectedTech) {
          return {
            uid: selectedTech.id,
            name: selectedTech.fullName,
            email: selectedTech.email,
            phone: selectedTech.phone,
            department: selectedTech.department,
            autoAssignedBySpecialty: true,
            specialtyMatched: category,
          };
        }
      }
    } catch (err) {
      console.warn('[TicketService] Could not resolve user list for auto-assignment:', err);
    }

    // Default Fallback
    return {
      uid: 'it-unit-team',
      name: 'IT Operations Unit',
      email: 'it-unit@hospital.local',
      autoAssignedBySpecialty: false,
    };
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
    let ticketNumber = await getNextTicketNumber();
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

    // Automatically assign incoming ticket based on ticket category
    const autoAssignee = await this.determineAutoAssignee(data.category, data.department);

    const newTicket: Ticket = {
      id,
      ticketNumber,
      title: data.title,
      description: data.description,
      category: data.category,
      subcategory: data.subcategory,
      priority: data.priority,
      status: autoAssignee ? 'Assigned' : 'New',
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
      assignedTo: autoAssignee,
      assignedAt: autoAssignee ? now : undefined,
      assetId: data.assetId || null,
      attachments: data.attachments || [],
      comments: autoAssignee?.autoAssignedBySpecialty
        ? [
            {
              id: generateUUID(),
              userId: 'hitoms-system',
              userName: 'HITOMS Auto-Dispatch',
              userRole: 'SUPER_ADMIN',
              comment: `Ticket automatically assigned to ${autoAssignee.name} based on monthly specialty for [${autoAssignee.specialtyMatched || data.category}] (${autoAssignee.month || 'Current Month'}).`,
              createdAt: now,
            },
          ]
        : [],
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

    try {
      await putToStore('tickets', newTicket);
    } catch (putErr: any) {
      if (
        putErr?.name === 'ConstraintError' ||
        (typeof putErr?.message === 'string' && putErr.message.includes('uniqueness'))
      ) {
        // Regenerate guaranteed unique ticket number with timestamp entropy
        const fallbackSeq = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
        const fallbackNum = `HIT-${new Date().getFullYear()}-${fallbackSeq}`;
        newTicket.ticketNumber = fallbackNum;
        ticketNumber = fallbackNum;
        await putToStore('tickets', newTicket);
      } else {
        throw putErr;
      }
    }

    // Audit and Notification
    await auditService.logAction('CREATE_TICKET', 'Tickets', id, null, {
      ticketNumber,
      title: data.title,
      priority: data.priority,
      department: data.department,
      assignedTo: autoAssignee?.name,
    });

    await notificationService.notify(
      `New Ticket #${ticketNumber} Auto-Assigned`,
      `[${data.priority}] ${data.title} (${data.category}) automatically assigned to ${autoAssignee.name}`,
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

    const isIT = ['IT_ADMIN', 'IT_OFFICER'].includes(actor.role) || (actor.department && actor.department.toLowerCase().includes('it'));
    if (isIT) {
      throw new Error('Access Denied: IT unit personnel cannot rate IT service. Confirmation and rating must be submitted by the unit staff.');
    }

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

    if (ticket.status === 'Closed') {
      const isIT = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_OFFICER'].includes(user.role);
      if (!isIT) {
        throw new Error('This ticket is closed. Staff comments cannot be added to closed tickets.');
      }
    }

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

    // Trigger bell ring sound & notification when a comment is written on a ticket
    try {
      await ticketSoundService.ringTicketCommentAlert(ticket, commentText, user);
    } catch (e) {
      console.warn('[TicketService] Failed to ring comment alert:', e);
    }

    return ticket;
  }

  public async deleteTicket(id: string, currentUser?: User | null): Promise<void> {
    const existing = await this.getTicketById(id);
    if (!existing) return;

    await deleteFromStore('tickets', id);

    await auditService.logAction('DELETE_TICKET', 'Tickets', id, existing, {
      ticketNumber: existing.ticketNumber,
      title: existing.title,
      deletedBy: currentUser?.fullName || 'Super Admin',
    });

    await syncService.enqueueOperation('tickets', id, 'DELETE', { id, ticketNumber: existing.ticketNumber });
  }
}

export const ticketService = new TicketService();
