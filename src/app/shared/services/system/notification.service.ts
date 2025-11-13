import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: string;
  progress?: number;
  showProgress?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();
  private notifications: Notification[] = [];

  addNotification(
    message: string,
    type: string,
    showProgress: boolean = false
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      progress: showProgress ? 0 : undefined,
      showProgress,
    };
    this.notifications.push(notification);
    this.notificationsSubject.next(this.notifications);

    if (!showProgress) {
      setTimeout(() => this.removeNotification(notification), 5000);
    }

    return notification.id;
  }

  updateProgress(notificationId: string, progress: number) {
    const notification = this.notifications.find(
      (n) => n.id === notificationId
    );
    if (notification && notification.showProgress) {
      notification.progress = Math.min(100, Math.max(0, progress));
      this.notificationsSubject.next(this.notifications);

      // Auto-remove when progress reaches 100%
      if (progress >= 100) {
        setTimeout(() => this.removeNotificationById(notificationId), 2000);
      }
    }
  }

  removeNotification(notification: Notification) {
    this.notifications = this.notifications.filter((n) => n !== notification);
    this.notificationsSubject.next(this.notifications);
  }

  removeNotificationById(notificationId: string) {
    this.notifications = this.notifications.filter(
      (n) => n.id !== notificationId
    );
    this.notificationsSubject.next(this.notifications);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
