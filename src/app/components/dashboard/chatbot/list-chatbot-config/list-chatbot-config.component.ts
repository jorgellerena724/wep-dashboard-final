import {
  Component,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../../shared/components/app-table/app.table.component';
import { ButtonModule } from 'primeng/button';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { icons } from '../../../../core/constants/icons.constant';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CreateEditChatbotConfigComponent } from '../create-chatbot-config/create-edit-chatbot-config.component';

@Component({
  selector: 'app-list-chatbot-config',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListChatbotConfigComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(ChatbotService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Computed signals para traducciones de estado
  activeStatus = computed(() =>
    this.transloco.translate('status.active').trim()
  );
  inactiveStatus = computed(() =>
    this.transloco.translate('status.inactive').trim()
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    const userNameTranslation = this.transloco.translate(
      'components.chatbot_config.list.table.name'
    );
    const modelNameTranslation = this.transloco.translate(
      'components.chatbot_config.list.table.model'
    );
    const tokensRemainingTranslation = this.transloco.translate(
      'components.chatbot_config.list.table.tokens_remaining'
    );
    const tokensLimitTranslation = this.transloco.translate(
      'components.chatbot_config.list.table.tokens_limit'
    );

    return [
      {
        field: 'user_name',
        header: userNameTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'model_name',
        header: modelNameTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'tokens_remaining',
        header: tokensRemainingTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'tokens_limit',
        header: tokensLimitTranslation,
        sortable: true,
        filter: true,
      },
    ];
  });

  headerActions = computed<TableAction[]>(() => {
    const createTranslation = this.transloco.translate('table.buttons.create');
    return [
      {
        label: createTranslation,
        icon: icons['add'],
        onClick: () => this.create(),
        class: 'p-button-primary',
      },
    ];
  });

  rowActions = computed<RowAction[]>(() => {
    const editTranslation = this.transloco.translate('table.buttons.edit');
    const deleteTranslation = this.transloco.translate('table.buttons.delete');
    const enableTranslation = this.transloco.translate('table.buttons.enable');
    const disableTranslation = this.transloco.translate(
      'table.buttons.disable'
    );

    return [
      {
        label: editTranslation,
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
      },
      {
        label: deleteTranslation,
        icon: icons['delete'],
        onClick: (data) => this.delete(data),
        class: buttonVariants.outline.red,
      },
      {
        label: (data) => (data.status ? disableTranslation : enableTranslation),
        icon: (data) => (data.status ? icons['activate'] : icons['deactivate']),
        onClick: (data) => this.toggleStatus(data),
        class: (data) =>
          data.status
            ? buttonVariants.outline.gray
            : buttonVariants.outline.neutral,
      },
    ];
  });

  // Computed para traducciones del diálogo de eliminación
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate('components.chatbot_config.delete.title'),
    message: this.transloco.translate(
      'components.chatbot_config.delete.message'
    ),
    confirm: this.transloco.translate(
      'components.chatbot_config.delete.confirm'
    ),
    cancel: this.transloco.translate('components.chatbot_config.delete.cancel'),
  }));

  constructor() {
    // Cargar datos iniciales
    this.loadData();

    // Effect para recargar cuando cambie el idioma
    effect(() => {
      this.transloco.selectTranslate('table.buttons.create');
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: HomeData[]) => {
          const active = this.activeStatus();
          const inactive = this.inactiveStatus();

          const processedData = data.map((item: any) => ({
            ...item,
            user_name: item.user.full_name,
            model_name: item.model.name,
            statusToShow: item.status ? active : inactive,
          }));

          this.data.set(processedData);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.chatbot_config.error.load'),
            'error'
          );
          this.loading.set(false);
        },
      });
  }

  onRefresh(): void {
    this.loadData();
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.chatbot_config.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotConfigComponent,
      data: {
        initialData: {
          onSave: () => {
            this.loadData();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.chatbot_config.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateEditChatbotConfigComponent,
      data: {
        initialData: {
          ...data,
          onSave: () => {
            this.loadData();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  async delete(data: any): Promise<void> {
    const translations = this.deleteTranslations();

    const confirmed = await this.confirmDialogService.confirm({
      title: translations.title,
      message: translations.message,
      confirmLabel: translations.confirm,
      cancelLabel: translations.cancel,
    });

    if (confirmed) {
      this.loading.set(true);
      this.srv
        .delete(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.notificationSrv.addNotification(
              this.transloco.translate(
                'notifications.chatbot_config.success.deleted'
              ),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error?.statusCode === 400 &&
              error.error?.message?.includes('Cannot delete')
            ) {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.chatbot_config.error.cannotDelete'
                ),
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.chatbot_config.error.delete'
                ),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }

  toggleStatus(data: any): void {
    const currentData = this.data();
    const newStatus = !data.status;
    const formData = new FormData();
    formData.append('status', String(newStatus));

    this.srv
      .patch(formData, data.user_id) // Usar user_id
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const active = this.activeStatus();
          const inactive = this.inactiveStatus();

          // Actualizar estado local inmutablemente
          const updatedData = currentData.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  status: newStatus,
                  statusToShow: newStatus ? active : inactive,
                }
              : item
          );

          this.data.set(updatedData);

          const statusText = newStatus ? active : inactive;
          const message = this.transloco.translate(
            'notifications.chatbot_config.success.statusUpdated',
            { status: statusText }
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            const message = this.transloco.translate(
              'notifications.chatbot_config.error.statusUpdate'
            );
            this.notificationSrv.addNotification(message, 'error');
          }
        },
      });
  }
}
