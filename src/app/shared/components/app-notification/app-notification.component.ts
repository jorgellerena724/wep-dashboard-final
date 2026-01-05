import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NotificationService,
  Notification,
} from '../../services/system/notification.service';

@Component({
  selector: 'app-notification',
  templateUrl: './app-notification.component.html',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush, // CRUCIAL para zoneless
})
export class NotificationComponent {
  private notificationService = inject(NotificationService);

  // Usar la señal directamente del servicio
  notifications = this.notificationService.notifications;

  // Computed signal para notificaciones ordenadas (opcional)
  sortedNotifications = computed(
    () => [...this.notifications()].reverse() // Mostrar las más recientes primero
  );

  removeNotification(notification: Notification): void {
    this.notificationService.removeNotification(notification);
  }

  roundProgress(progress: number | undefined): number {
    return Math.round(progress || 0);
  }

  // Computed signal para determinar si hay notificaciones
  hasNotifications = computed(() => this.notifications().length > 0);
}
