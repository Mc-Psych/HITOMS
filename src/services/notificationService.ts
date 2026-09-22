import { type AppNotification } from '../types';
import {
  getAllFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
} from './localDatabaseService';

export interface SendMessageParams {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  module?: string;
  targetType: 'ALL' | 'UNIT' | 'USER';
  targetUnit?: string;
  targetUserId?: string;
  senderName?: string;
  senderRole?: string;
  linkId?: string;
}

class NotificationService {
  public async notify(
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
    module: string,
    userId: string = 'ALL',
    linkId?: string,
    extra?: {
      targetType?: 'ALL' | 'UNIT' | 'USER';
      targetUnit?: string;
      senderName?: string;
      senderRole?: string;
    }
  ): Promise<void> {
    const notif: AppNotification = {
      id: generateUUID(),
      userId,
      title,
      message,
      type,
      module,
      linkId,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetType: extra?.targetType || (userId === 'ALL' ? 'ALL' : userId.startsWith('DEPT:') ? 'UNIT' : 'USER'),
      targetUnit: extra?.targetUnit,
      senderName: extra?.senderName,
      senderRole: extra?.senderRole,
    };
    await putToStore('notifications', notif);
  }

  public async sendMessage(params: SendMessageParams): Promise<void> {
    let targetUserId = 'ALL';
    if (params.targetType === 'USER' && params.targetUserId) {
      targetUserId = params.targetUserId;
    } else if (params.targetType === 'UNIT' && params.targetUnit) {
      targetUserId = `DEPT:${params.targetUnit}`;
    }

    await this.notify(
      params.title,
      params.message,
      params.type,
      params.module || 'IT Broadcast & Messaging',
      targetUserId,
      params.linkId,
      {
        targetType: params.targetType,
        targetUnit: params.targetUnit,
        senderName: params.senderName,
        senderRole: params.senderRole,
      }
    );
  }

  public async getNotifications(userId?: string, userDepartment?: string): Promise<AppNotification[]> {
    const all = await getAllFromStore<AppNotification>('notifications');
    return all
      .filter((n) => {
        if (n.userId === 'ALL' || n.targetType === 'ALL') return true;
        if (userId && n.userId === userId) return true;
        if (n.targetType === 'UNIT' && userDepartment) {
          if (n.targetUnit && n.targetUnit.toLowerCase() === userDepartment.toLowerCase()) return true;
          if (n.userId.toLowerCase() === `dept:${userDepartment.toLowerCase()}`) return true;
        }
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getAllSentMessages(): Promise<AppNotification[]> {
    const all = await getAllFromStore<AppNotification>('notifications');
    return all
      .filter((n) => n.senderName || n.targetType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async markAsRead(id: string): Promise<void> {
    const notif = await getAllFromStore<AppNotification>('notifications');
    const target = notif.find((n) => n.id === id);
    if (target) {
      target.isRead = true;
      await putToStore('notifications', target);
    }
  }

  public async clearAll(): Promise<void> {
    const notifs = await getAllFromStore<AppNotification>('notifications');
    for (const n of notifs) {
      await deleteFromStore('notifications', n.id);
    }
  }
}

export const notificationService = new NotificationService();
