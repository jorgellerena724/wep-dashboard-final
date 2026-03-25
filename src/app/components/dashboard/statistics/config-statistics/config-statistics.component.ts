import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  signal,
  ChangeDetectionStrategy,
  computed,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MetricsService,
  MetricEvent,
  MetricsConfig,
} from '../../../../shared/services/features/metrics.service';
import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../../shared/components/app-table/app.table.component';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { CreateEditStatisticComponent } from '../create-edit-statistic/create-edit-statistic.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { icons } from '../../../../core/constants/icons.constant';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';

@Component({
  selector: 'app-config-statistics',
  standalone: true,
  imports: [CommonModule, TranslocoModule, TableComponent, TooltipModule],
  templateUrl: './config-statistics.component.html',
  styleUrls: ['./config-statistics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigStatisticsComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private cd = inject(ChangeDetectorRef);
  private metricsSrv = inject(MetricsService);
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);
  private destroy$ = new Subject<void>();

  // Signals para el estado
  data = signal<MetricEvent[]>([]);
  loading = signal<boolean>(false);
  config = signal<MetricsConfig | null>(null);

  // ViewChild para el template de estado
  statusTemplate = viewChild<TemplateRef<any>>('statusTemplate');

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const statusTpl = this.statusTemplate();
    const templates: { [key: string]: any } = {};

    if (statusTpl) templates['is_active'] = statusTpl;

    return templates;
  });

  // Signals reactivos para traducciones de columnas
  private eventNameTranslation = toSignal(
    this.transloco.selectTranslate(
      'components.statistics.config.table.event_name',
    ),
    { initialValue: '' },
  );
  private labelTranslation = toSignal(
    this.transloco.selectTranslate('components.statistics.config.table.label'),
    { initialValue: '' },
  );
  private statusTranslation = toSignal(
    this.transloco.selectTranslate('components.statistics.config.table.status'),
    { initialValue: '' },
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    return [
      {
        field: 'event_name',
        header: this.eventNameTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'label',
        header: this.labelTranslation(),
        sortable: true,
        filter: true,
      },
      {
        field: 'is_active',
        header: this.statusTranslation(),
        width: '120px',
        sortable: true,
      },
    ];
  });

  // Signals reactivos para traducciones de acciones
  private createTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.create'),
    { initialValue: '' },
  );
  private editTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.edit'),
    { initialValue: '' },
  );
  private deleteTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.delete'),
    { initialValue: '' },
  );
  private activateTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.enable'),
    { initialValue: '' },
  );
  private deactivateTranslation = toSignal(
    this.transloco.selectTranslate('table.buttons.disable'),
    { initialValue: '' },
  );

  headerActions = computed<TableAction[]>(() => {
    return [
      {
        label: this.createTranslation(),
        icon: icons['add'],
        onClick: () => this.create(),
        class: 'p-button-primary',
      },
    ];
  });

  rowActions = computed<RowAction[]>(() => {
    return [
      {
        label: this.editTranslation(),
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
      },
      {
        label: (data) =>
          data.is_active
            ? this.deactivateTranslation()
            : this.activateTranslation(),
        icon: (data) =>
          data.is_active ? icons['deactivate'] : icons['activate'],
        onClick: (data) => this.toggleStatus(data),
        class: (data) =>
          data.is_active
            ? buttonVariants.outline.gray
            : buttonVariants.outline.neutral,
      },
      {
        label: this.deleteTranslation(),
        icon: icons['delete'],
        onClick: (data) => this.delete(data),
        class: buttonVariants.outline.red,
      },
    ];
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loading.set(true);
    this.metricsSrv
      .getConfig()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.data.set(cfg.events);
          this.loading.set(false);
          this.cd.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cd.markForCheck();
        },
      });
  }

  onRefresh(): void {
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.statistics.create.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditStatisticComponent,
      showExpandButton: false,
      data: {
        initialData: {
          onSave: () => {
            this.onRefresh();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  edit(data: MetricEvent): void {
    const translatedTitle = this.transloco.translate(
      'components.statistics.edit.title',
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditStatisticComponent,
      showExpandButton: false,
      data: {
        initialData: {
          ...data,
          onSave: () => {
            this.onRefresh();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  toggleStatus(data: MetricEvent): void {
    const newStatus = !data.is_active;

    this.metricsSrv
      .updateEvent(data.event_name, undefined, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.onRefresh();
          const actionKey = newStatus ? 'activated' : 'deactivated';
          const message = this.transloco.translate(
            `notifications.statistics.success.${actionKey}`,
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          const actionKey = newStatus ? 'activate' : 'deactivate';
          const message = this.transloco.translate(
            `notifications.statistics.error.${actionKey}`,
          );
          this.notificationSrv.addNotification(message, 'error');
        },
      });
  }

  async delete(data: MetricEvent): Promise<void> {
    const titleTranslation = this.transloco.translate(
      'components.statistics.delete.title',
    );
    const messageTranslation = this.transloco.translate(
      'components.statistics.delete.message',
    );
    const confirmTranslation = this.transloco.translate(
      'components.statistics.delete.confirm',
    );
    const cancelTranslation = this.transloco.translate(
      'components.statistics.delete.cancel',
    );

    const confirmed = await this.confirmDialogService.confirm({
      title: titleTranslation,
      message: messageTranslation,
      confirmLabel: confirmTranslation,
      cancelLabel: cancelTranslation,
    });

    if (confirmed) {
      this.loading.set(true);

      this.metricsSrv
        .deleteEvent(data.event_name)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.onRefresh();
            const message = this.transloco.translate(
              'notifications.statistics.success.deleted',
            );
            this.notificationSrv.addNotification(message, 'success');
          },
          error: (error) => {
            const message = this.transloco.translate(
              'notifications.statistics.error.delete',
            );
            this.notificationSrv.addNotification(message, 'error');
            this.loading.set(false);
          },
        });
    }
  }
}
