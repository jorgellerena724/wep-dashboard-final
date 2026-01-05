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
import { CreatePublicationCategoryComponent } from '../create-publication-category/create-publication-category.component';
import { UpdatePublicationCategoryComponent } from '../update-publication-category/update-publication-category.component';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-publication-category',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-publication-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPublicationCategoryComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(PublicationCategoryService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Computed signals para traducciones
  columns = computed<Column[]>(() => {
    const nameTranslation = this.transloco.translate(
      'components.publication-category.list.table.name'
    );

    return [
      {
        field: 'title',
        header: nameTranslation,
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

  // Computed para traducciones del diálogo de eliminación
  private deleteTranslations = computed(() => ({
    title: this.transloco.translate(
      'components.publication-category.delete.title'
    ),
    message: this.transloco.translate(
      'components.publication-category.delete.message'
    ),
    confirm: this.transloco.translate(
      'components.publication-category.delete.confirm'
    ),
    cancel: this.transloco.translate(
      'components.publication-category.delete.cancel'
    ),
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
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publication-category.error.load'
            ),
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
      'components.publication-category.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreatePublicationCategoryComponent,
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
      'components.publication-category.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdatePublicationCategoryComponent,
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
                'notifications.publication-category.success.deleted'
              ),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes('No se puede eliminar la categoría')
            ) {
              this.notificationSrv.addNotification(
                error.error.message,
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publication-category.error.delete'
                ),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }
}
