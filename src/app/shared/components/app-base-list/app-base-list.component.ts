// shared/components/base-list/base-list.component.ts
import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  viewChildren,
  viewChild,
  TemplateRef,
  DestroyRef,
  ChangeDetectionStrategy,
  afterNextRender,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../app-table/app.table.component';
import { ModalService } from '../../services/system/modal.service';
import { NotificationService } from '../../services/system/notification.service';
import { ConfirmDialogService } from '../../services/system/confirm-dialog.service';
import { ListConfig } from '../../interfaces/list-config.interface';
import { HomeData } from '../../interfaces/home.interface';

@Component({
  selector: 'app-base-list',
  standalone: true,
  imports: [TableComponent],
  template: `
    <app-table
      [data]="data()"
      [columns]="columns()"
      [loading]="loading()"
      [customTemplates]="customTemplates()"
      [headerActions]="headerActions()"
      [rowActions]="rowActions()"
      (refresh)="onRefresh()"
    ></app-table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseListComponent<T = HomeData> {
  // Input signals - sin decorador, usando la nueva API
  config = input.required<ListConfig<T>>();
  title = input<string>('');

  // Output signals
  refresh = output<void>();
  rowClicked = output<T>();

  // Inyección de servicios
  protected transloco = inject(TranslocoService);
  protected notificationSrv = inject(NotificationService);
  protected modalSrv = inject(ModalService);
  protected confirmDialogService = inject(ConfirmDialogService);
  protected destroyRef = inject(DestroyRef);

  // Señales de estado
  protected data = signal<T[]>([]);
  protected loading = signal(false);
  protected mediaUrls = signal<{ [key: number]: string }>({});

  // Computed signals
  protected columns = computed<Column[]>(() => {
    const config = this.config();
    if (typeof config.columns === 'function') {
      return config.columns(this.transloco);
    }
    return config.columns || [];
  });

  protected customTemplates = computed(() => {
    const config = this.config();
    return config.customTemplates || {};
  });

  protected headerActions = computed(() => {
    const config = this.config();
    const actions: TableAction[] = [];

    if (config.actions?.create?.enabled && config.actions.create.component) {
      const label = this.transloco.translate(
        config.actions.create.translationKey ||
          `${config.translationPrefix}.create`
      );
      actions.push({
        label,
        icon: 'pi pi-plus',
        onClick: () => this.handleCreate(),
        class: 'p-button-primary',
      });
    }

    if (config.customHeaderActions) {
      const customActions = config.customHeaderActions(this.transloco);
      actions.push(...customActions);
    }

    return actions;
  });

  protected rowActions = computed(() => {
    const config = this.config();
    const actions: RowAction[] = [];

    if (config.actions?.edit?.enabled && config.actions.edit.component) {
      actions.push({
        label: this.transloco.translate('table.buttons.edit'),
        icon: 'pi pi-pencil',
        onClick: (row) => this.handleEdit(row as T),
        class: 'p-button-outlined p-button-success',
      });
    }

    if (config.actions?.delete?.enabled) {
      actions.push({
        label: this.transloco.translate('table.buttons.delete'),
        icon: 'pi pi-trash',
        onClick: (row) => this.handleDelete(row as any),
        class: 'p-button-outlined p-button-danger',
      });
    }

    if (config.actions?.toggleStatus?.enabled) {
      actions.push({
        label: (row: any) =>
          row.status
            ? this.transloco.translate('table.buttons.disable')
            : this.transloco.translate('table.buttons.enable'),
        icon: (row: any) => (row.status ? 'pi pi-ban' : 'pi pi-check'),
        onClick: (row) => this.handleToggleStatus(row as any),
        class: (row: any) =>
          row.status
            ? 'p-button-outlined p-button-warning'
            : 'p-button-outlined p-button-help',
      });
    }

    if (config.customRowActions) {
      const customActions = config.customRowActions(this.transloco);
      actions.push(...customActions);
    }

    return actions;
  });

  constructor() {
    // Cargar datos después de la primera renderización
    afterNextRender(() => {
      this.loadData();
    });

    // Recargar cuando cambie el idioma
    effect(() => {
      this.transloco.langChanges$.subscribe(() => {
        this.loadData();
      });
    });
  }

  protected loadData(): void {
    const config = this.config();
    if (!config?.service?.get) {
      console.error('Service or get method not defined in config');
      return;
    }

    this.loading.set(true);
    config.service
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: T[]) => {
          this.processData(items);
          this.loadMediaFiles(items);
          this.loading.set(false);
        },
        error: (error: any) => {
          this.handleError('error.load', error);
          this.loading.set(false);
        },
      });
  }

  protected processData(items: T[]): void {
    const config = this.config();
    const processed = items.map((item: any) => ({
      ...item,
      statusToShow: item.status
        ? this.transloco.translate('status.active').trim()
        : this.transloco.translate('status.inactive').trim(),
    }));
    this.data.set(processed);
  }

  protected loadMediaFiles(items: any[]): void {
    const config = this.config();
    if (!config?.media?.serviceMethod) return;

    items.forEach((item) => {
      const mediaField = config.media.fieldName || 'photo';
      if (item[mediaField]) {
        config.media.serviceMethod!(item[mediaField])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (blob: Blob) => {
              const url = URL.createObjectURL(blob);
              this.mediaUrls.update((urls) => ({ ...urls, [item.id]: url }));
            },
            error: () => {
              this.handleError('error.loadMedia');
            },
          });
      }
    });
  }

  protected handleCreate(): void {
    const config = this.config();
    if (!config?.actions?.create?.component) return;

    const modalConfig = {
      title: this.transloco.translate(
        config.actions.create.translationKey || ''
      ),
      component: config.actions.create.component,
      data: { onSave: () => this.onRefresh() },
    };

    this.modalSrv.open(modalConfig);
  }

  protected handleEdit(row: T): void {
    const config = this.config();
    if (!config?.actions?.edit?.component) return;

    const modalConfig = {
      title: this.transloco.translate(config.actions.edit.translationKey || ''),
      component: config.actions.edit.component,
      data: {
        initialData: row,
        onSave: () => this.onRefresh(),
      },
    };

    this.modalSrv.open(modalConfig);
  }

  protected async handleDelete(row: any): Promise<void> {
    const config = this.config();

    if (config?.beforeDelete) {
      const canDelete = await config.beforeDelete(row);
      if (!canDelete) return;
    }

    if (config?.actions?.delete?.confirmDialog) {
      const confirmed = await this.confirmDialogService.confirm({
        title: this.transloco.translate(
          `${config.translationPrefix}.delete.title`
        ),
        message: this.transloco.translate(
          `${config.translationPrefix}.delete.message`
        ),
        confirmLabel: this.transloco.translate('common.confirm'),
        cancelLabel: this.transloco.translate('common.cancel'),
      });

      if (!confirmed) return;
    }

    this.loading.set(true);
    config.service
      .delete(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.onRefresh();
          this.handleSuccess('success.deleted');
        },
        error: (error: any) => {
          this.handleError('error.delete', error);
          this.loading.set(false);
        },
      });
  }

  protected handleToggleStatus(row: any): void {
    const config = this.config();
    if (!config?.status?.enabled) return;

    if (config.status?.minActiveItems && !row.status) {
      const activeItems = this.data().filter(
        (item: any) => item.status && item.id !== row.id
      ).length;

      if (activeItems < config.status.minActiveItems) {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            `${config.translationPrefix}.errors.minActive`
          ),
          'error'
        );
        return;
      }
    }

    const newStatus = !row.status;
    const formData = new FormData();
    formData.append('id', row.id);
    formData.append('status', String(newStatus));

    config.service
      .patch(formData, row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.updateLocalStatus(row.id, newStatus);
          this.handleSuccess('success.statusUpdated', {
            status: newStatus
              ? this.transloco.translate('status.active')
              : this.transloco.translate('status.inactive'),
          });
        },
        error: (error: any) => this.handleError('error.statusUpdate', error),
      });
  }

  protected updateLocalStatus(id: number, status: boolean): void {
    this.data.update((items) =>
      items.map((item) => {
        const typedItem = item as any;
        if (typedItem.id === id) {
          return {
            ...typedItem,
            status,
            statusToShow: status
              ? this.transloco.translate('status.active').trim()
              : this.transloco.translate('status.inactive').trim(),
          };
        }
        return item;
      })
    );
  }

  public onRefresh(): void {
    // Limpiar URLs de medios anteriores
    const urls = this.mediaUrls();
    Object.values(urls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    this.mediaUrls.set({});
    this.refresh.emit();
    this.loadData();

    const config = this.config();
    if (config?.afterRefresh) {
      config.afterRefresh();
    }
  }

  protected handleSuccess(key: string, params?: any): void {
    const config = this.config();
    const message = this.transloco.translate(
      `${config.translationPrefix}.${key}`,
      params
    );
    this.notificationSrv.addNotification(message, 'success');
  }

  protected handleError(key: string, error?: any): void {
    const config = this.config();
    let message = this.transloco.translate(
      `${config.translationPrefix}.${key}`
    );

    if (error?.error?.message && error.error?.statusCode === 400) {
      message = error.error.message;
    }

    this.notificationSrv.addNotification(message, 'error');
  }

  // Métodos públicos para componentes hijos
  public getMediaUrl(id: number): string {
    return this.mediaUrls()[id] || '';
  }

  public getCurrentData(): T[] {
    return this.data();
  }

  public updateData(newData: T[]): void {
    this.data.set(newData);
  }

  public getLoading(): boolean {
    return this.loading();
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
}
