import { type AppNotification } from '../types';
import {
  getAllFromStore,
  putToStore,
  deleteFromStore,
  generateUUID,
} from './localDatabaseService';

class NotificationService {
  public async notify(
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success',
    module: string,
    userId: string = 'ALL',
    linkId?: string
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
    };
    await putToStore('notifications', notif);
  }

  public async getNotifications(userId?: string): Promise<AppNotification[]> {
    const all = await getAllFromStore<AppNotification>('notifications');
    return all
      .filter((n) => n.userId === 'ALL' || (userId && n.userId === userId))
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
