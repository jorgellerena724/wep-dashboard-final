import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
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
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { CreateChatbotModelComponent } from '../create-chatbot-model/create-chatbot-model.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UpdateChatbotModelComponent } from '../update-chatbot-model/update-chatbot-model.component';

@Component({
  selector: 'app-list-chatbot-model',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-chatbot-model.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListChatbotModelComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private confirmDialogService = inject(ConfirmDialogService);
  private srv = inject(ChatbotService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    const nameTranslation = this.transloco.translate(
      'components.chatbot_model.list.table.name'
    );
    const providerTranslation = this.transloco.translate(
      'components.chatbot_model.list.table.provider'
    );

    return [
      {
        field: 'name',
        header: nameTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'provider',
        header: providerTranslation,
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
    ];
  });

  // Computed para traducciones de confirmación (opcional pero recomendado)
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate('components.news.delete.title'),
    message: this.transloco.translate('components.news.delete.message'),
    confirm: this.transloco.translate('components.news.delete.confirm'),
    cancel: this.transloco.translate('components.news.delete.cancel'),
  }));

  constructor() {
    this.loadData();

    effect(() => {
      this.transloco.selectTranslate('table.buttons.create');
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.srv
      .getModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: HomeData[]) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.chatbot_model.error.load'),
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
      'components.chatbot_model.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreateChatbotModelComponent,
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
      'components.chatbot_model.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdateChatbotModelComponent,
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
        .deleteModel(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.notificationSrv.addNotification(
              this.transloco.translate('notifications.news.success.deleted'),
              'success'
            );
          },
          error: (error) => {
            this.handleDeleteError(error);
          },
        });
    }
  }

  private handleDeleteError(error: any): void {
    let message = '';

    if (error.status === 400) {
      const detail = error.error?.detail || '';
      if (detail.includes('Cannot delete model')) {
        message = this.transloco.translate(
          'notifications.chatbot_model.error.cannotDelete'
        );
      } else {
        message = detail;
      }
    } else if (error.status === 404) {
      message = this.transloco.translate(
        'notifications.chatbot_model.error.notFound'
      );
    } else {
      message = this.transloco.translate(
        'notifications.chatbot_model.error.delete'
      );
    }

    this.notificationSrv.addNotification(message, 'error');
    this.loading.set(false);
  }
}
