import {
  Component,
  inject,
  signal,
  computed,
  effect,
  TemplateRef,
  viewChild,
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
import { PublicationData } from '../../../../shared/interfaces/publications.interface';
import { ConfirmDialogService } from '../../../../shared/services/system/confirm-dialog.service';
import { PublicationsService } from '../../../../shared/services/features/publications.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CreatePublicationComponent } from '../create-publication/create-publication.component';
import { UpdatePublicationComponent } from '../update-publication/update-publication.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-publications',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-publications.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPublicationComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(PublicationsService);
  private confirmDialogService = inject(ConfirmDialogService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signals
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: TemplateRef<any> }>(() => {
    const imgTemplate = this.imageTemplate();
    const templates: { [key: string]: TemplateRef<any> } = {};

    if (imgTemplate) {
      templates['firstImage'] = imgTemplate;
    }

    return templates;
  });

  // Computed signals para traducciones
  columns = computed<Column[]>(() => {
    const nameTranslation = this.transloco.translate(
      'components.publications.list.table.name'
    );
    const categoryTranslation = this.transloco.translate(
      'components.publications.list.table.category'
    );
    const imageTranslation = this.transloco.translate(
      'components.publications.list.table.image'
    );

    return [
      {
        field: 'title',
        header: nameTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'categoryName',
        header: categoryTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'firstImage',
        header: imageTranslation,
        width: '240px',
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
    title: this.transloco.translate('components.publications.delete.title'),
    message: this.transloco.translate('components.publications.delete.message'),
    confirm: this.transloco.translate('components.publications.delete.confirm'),
    cancel: this.transloco.translate('components.publications.delete.cancel'),
  }));

  constructor() {
    // Cargar datos iniciales
    this.loadData();

    // Effect para recargar cuando cambie el idioma
    effect(() => {
      this.transloco.selectTranslate('table.buttons.create');
      // Las computed properties se actualizarán automáticamente
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: PublicationData[]) => {
          const processedData = data.map((item: any) => ({
            ...item,
            categoryName: item.publication_category.title,
          }));

          this.data.set(processedData);
          this.loading.set(false);

          // Cargar las imágenes de las publicaciones
          this.loadPublicationImages(processedData);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.publications.error.load'),
            'error'
          );
          this.loading.set(false);
        },
      });
  }

  private loadPublicationImages(publications: any[]): void {
    publications.forEach((item) => {
      if (item.photo) {
        this.srv
          .getImage(item.photo)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (imageBlob) => {
              const url = URL.createObjectURL(imageBlob);
              this.imageUrls.update((urls) => ({ ...urls, [item.id]: url }));
            },
            error: (error) => {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.managers.error.loadImage'
                ),
                'error'
              );
            },
          });
      }
    });
  }

  onRefresh(): void {
    this.cleanupBlobUrls();
    this.imageUrls.set({});
    this.loadData();
  }

  getImageUrl(rowData: any): string {
    return this.imageUrls()[rowData.id] || '';
  }

  create(): void {
    const translatedTitle = this.transloco.translate(
      'components.publications.create.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: CreatePublicationComponent,
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
      'components.publications.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdatePublicationComponent,
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

  onImageError(event: any): void {
    event.target.style.display = 'none';
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
                'notifications.publications.success.deleted'
              ),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes(
                'No se puede eliminar la publicación'
              )
            ) {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publications.error.cannotDelete'
                ),
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.publications.error.delete'
                ),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }

  private cleanupBlobUrls(): void {
    const images = this.imageUrls();
    Object.values(images).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}
