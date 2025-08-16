import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<any[]>([]);
  notifications$ = this.notificationsSubject.asObservable();
  private notifications: any[] = [];

  addNotification(message: string, type: string) {
    const notification = { message, type };
    this.notifications.push(notification);
    this.notificationsSubject.next(this.notifications);

    setTimeout(() => this.removeNotification(notification), 5000);
  }

  removeNotification(notification: any) {
    this.notifications = this.notifications.filter((n) => n !== notification);
    this.notificationsSubject.next(this.notifications);
  }
}