import {
  Component,
  OnInit,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, ChartModule, TranslocoModule],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
})
export class StatisticsComponent implements OnInit, OnDestroy {
  platformId = inject(PLATFORM_ID);
  cd = inject(ChangeDetectorRef);
  translocoService = inject(TranslocoService);

  // Datos para gráfica de usuarios por semana
  weeklyUsersData: any;
  weeklyUsersOptions: any;

  // Datos para gráfica de usuarios por mes
  monthlyUsersData: any;
  monthlyUsersOptions: any;

  private langSubscription?: Subscription;

  ngOnInit() {
    // Esperar a que las traducciones estén cargadas
    this.translocoService
      .selectTranslate('components.statistics.chart_labels.users')
      .subscribe(() => {
        this.initChart();
      });

    // Suscribirse a cambios de idioma
    this.langSubscription = this.translocoService.langChanges$.subscribe(() => {
      setTimeout(() => {
        this.initChart();
      }, 100);
    });
  }

  ngOnDestroy() {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }

  initChart() {
    if (isPlatformBrowser(this.platformId)) {
      const documentStyle = getComputedStyle(document.documentElement);
      const textColor =
        documentStyle.getPropertyValue('--p-text-color') || '#374151';
      const textColorSecondary =
        documentStyle.getPropertyValue('--p-text-muted-color') || '#6B7280';
      const surfaceBorder =
        documentStyle.getPropertyValue('--p-content-border-color') || '#E5E7EB';

      // Obtener traducciones con fallback
      const usersLabel =
        this.translocoService.translate(
          'components.statistics.chart_labels.users',
        ) || 'Users';

      const dayLabels = [
        this.translocoService.translate(
          'components.statistics.chart_labels.days.monday',
        ) || 'Monday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.tuesday',
        ) || 'Tuesday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.wednesday',
        ) || 'Wednesday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.thursday',
        ) || 'Thursday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.friday',
        ) || 'Friday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.saturday',
        ) || 'Saturday',
        this.translocoService.translate(
          'components.statistics.chart_labels.days.sunday',
        ) || 'Sunday',
      ];

      const monthLabels = [
        this.translocoService.translate(
          'components.statistics.chart_labels.months.january',
        ) || 'January',
        this.translocoService.translate(
          'components.statistics.chart_labels.months.february',
        ) || 'February',
        this.translocoService.translate(
          'components.statistics.chart_labels.months.march',
        ) || 'March',
        this.translocoService.translate(
          'components.statistics.chart_labels.months.april',
        ) || 'April',
        this.translocoService.translate(
          'components.statistics.chart_labels.months.may',
        ) || 'May',
        this.translocoService.translate(
          'components.statistics.chart_labels.months.june',
        ) || 'June',
      ];

      // Datos simulados para usuarios por semana
      this.weeklyUsersData = {
        labels: dayLabels,
        datasets: [
          {
            label: usersLabel,
            data: [120, 150, 180, 220, 200, 160, 140],
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      };

      // Datos simulados para usuarios por mes
      this.monthlyUsersData = {
        labels: monthLabels,
        datasets: [
          {
            label: usersLabel,
            data: [3200, 2800, 3500, 4100, 3800, 4200],
            backgroundColor: [
              'rgba(34, 197, 94, 0.2)',
              'rgba(59, 130, 246, 0.2)',
              'rgba(249, 115, 22, 0.2)',
              'rgba(139, 92, 246, 0.2)',
              'rgba(236, 72, 153, 0.2)',
              'rgba(6, 182, 212, 0.2)',
            ],
            borderColor: [
              'rgb(34, 197, 94)',
              'rgb(59, 130, 246)',
              'rgb(249, 115, 22)',
              'rgb(139, 92, 246)',
              'rgb(236, 72, 153)',
              'rgb(6, 182, 212)',
            ],
            borderWidth: 1,
          },
        ],
      };

      // Opciones comunes para ambas gráficas
      const commonOptions = {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        plugins: {
          legend: {
            labels: {
              color: textColor,
              font: {
                size: 14,
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColorSecondary,
              font: {
                size: 12,
              },
            },
            grid: {
              color: surfaceBorder,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColorSecondary,
              font: {
                size: 12,
              },
            },
            grid: {
              color: surfaceBorder,
            },
          },
        },
      };

      this.weeklyUsersOptions = { ...commonOptions };
      this.monthlyUsersOptions = { ...commonOptions };

      this.cd.markForCheck();
    }
  }
}
