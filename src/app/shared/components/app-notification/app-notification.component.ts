import { Component, OnInit } from '@angular/core';
import {
  NotificationService,
  Notification,
} from '../../services/system/notification.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification',
  templateUrl: './app-notification.component.html',
  styleUrls: ['./app-notification.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class NotificationComponent implements OnInit {
  notifications: Notification[] = [];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notificationService.notifications$.subscribe(
      (notifications: Notification[]) => {
        this.notifications = notifications;
      }
    );
  }

  removeNotification(notification: Notification): void {
    this.notificationService.removeNotification(notification);
  }
}
