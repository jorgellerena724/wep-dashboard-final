import {
  Component,
  inject,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';

import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../shared/components/app-table/app.table.component';
import { ButtonModule } from 'primeng/button';
import { buttonVariants } from '../../../core/constants/button-variant.constant';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { icons } from '../../../core/constants/icons.constant';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { CreateProductComponent } from '../create-product/create-product.component';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import { ProductService } from '../../../shared/services/features/product.service';
import { UpdateProductComponent } from '../update-product/update-product.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-product',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-product.component.html',
  standalone: true,
  providers: [],
})
export class ListProductComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: any[] = [];
  image: any;
  loading = false;
  activeStatus = '';
  inactiveStatus = '';
  imageUrls: { [key: number]: string } = {};
  videoUrls: { [key: number]: string } = {};

  @ViewChild('imageTemplate', { static: true })
  imageTemplate!: TemplateRef<any>;
  customTemplates: { [key: string]: TemplateRef<any> } = {};

  @ViewChild('variantsTemplate', { static: true })
  variantsTemplate!: TemplateRef<any>;

  columns: Column[] = [];

  // Definimos las acciones del encabezado
  headerActions: TableAction[] = [];

  // Definimos las acciones de fila
  rowActions: RowAction[] = [];

  constructor(
    private modalSrv: ModalService,
    private notificationSrv: NotificationService,
    private srv: ProductService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.setupTranslations();
    this.loadData();
  }

  private setupTranslations() {
    const headerActionsSubscription = this.transloco
      .selectTranslate('table.buttons.create')
      .subscribe((createTranslation) => {
        this.headerActions = [
          {
            label: createTranslation,
            icon: icons['add'],
            onClick: () => this.create(),
            class: 'p-button-primary',
          },
        ];
      });
    // Suscribirse a los cambios de idioma para actualizar las columnas
    const columnsTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.products.list.table.name'),
      this.transloco.selectTranslate(
        'components.products.list.table.variants.title'
      ),
      this.transloco.selectTranslate(
        'components.products.list.table.description'
      ),
      this.transloco.selectTranslate('components.products.list.table.category'),
      this.transloco.selectTranslate('components.products.list.table.image'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([
        nameTranslation,
        variantsTranslation,
        descriptionTranslation,
        categoryTranslation,
        imageTranslation,
      ]) => {
        this.columns = [
          {
            field: 'title',
            header: nameTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'variants',
            header: variantsTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'description',
            header: descriptionTranslation,
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
      }
    );

    const rowsTranslation$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.delete'),
      this.transloco.selectTranslate('table.buttons.disable'),
      this.transloco.selectTranslate('table.buttons.enable'),
    ]);

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = rowsTranslation$.subscribe(
      ([
        editTranslation,
        deleteTranslation,
        enableTranslation,
        disableTranslation,
      ]) => {
        this.rowActions = [
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
            label: (data) =>
              data.status ? disableTranslation : enableTranslation,
            icon: (data) =>
              data.status ? icons['activate'] : icons['deactivate'],
            onClick: (data) => this.toggleStatus(data),
            class: (data) =>
              data.status
                ? buttonVariants.outline.gray
                : buttonVariants.outline.neutral,
          },
        ];
      }
    );

    this.subscriptions.push(
      headerActionsSubscription,
      columnsSubscription,
      rowActionsSubscription
    );
  }

  ngAfterViewInit() {
    this.customTemplates['firstImage'] = this.imageTemplate;
    this.customTemplates['variants'] = this.variantsTemplate;
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data: HomeData[]) => {
        this.data = data.map((item: any) => {
          let variantsText = '';

          if (item.variants && Array.isArray(item.variants)) {
            variantsText = item.variants
              .map((v: any) => `${v.description}: ${v.price}$`)
              .join(', ');
          }

          // Obtener la primera imagen del array files
          const firstFile =
            item.files && item.files.length > 0 ? item.files[0] : null;
          const firstImagePath = firstFile ? firstFile.media : null;
          const isVideo = firstImagePath
            ? this.isVideoFile(firstImagePath)
            : false;

          return {
            ...item,
            categoryName: item.category.title,
            variantsText,
            firstImagePath,
            isVideo,
            firstFileTitle: firstFile ? firstFile.title : '',
          };
        });
        this.loading = false;

        // Cargar las imágenes/videos de los productos
        this.loadProductMedia();
      },
      error: (error) => {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.products.error.load'),
          'error'
        );
        this.loading = false;
      },
    });
  }

  private loadProductMedia(): void {
    this.data.forEach((item) => {
      if (item.firstImagePath) {
        this.srv.getImage(item.firstImagePath).subscribe({
          next: (fileBlob) => {
            if (item.isVideo) {
              this.videoUrls[item.id] = URL.createObjectURL(fileBlob);
            } else {
              this.imageUrls[item.id] = URL.createObjectURL(fileBlob);
            }
          },
          error: (error) => {
            console.error(`Error loading media for product ${item.id}:`, error);
            // No mostrar notificación para evitar spam
          },
        });
      }
    });
  }

  private isVideoFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension || '');
  }

  onRefresh() {
    // Limpiar URLs de imágenes
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Limpiar URLs de videos
    Object.values(this.videoUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    this.imageUrls = {};
    this.videoUrls = {};
    this.loadData();
  }

  getVideoUrl(rowData: any): string {
    return this.videoUrls[rowData.id] || '';
  }

  getImageUrl(rowData: any): string {
    return this.imageUrls[rowData.id] || '';
  }

  create() {
    this.transloco
      .selectTranslate('components.products.create.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: CreateProductComponent,
          data: {
            initialData: {
              onSave: () => {
                this.loadData();
              },
            },
          },
        };
        this.modalSrv.open(modalConfig);
      });
  }

  edit(data: any) {
    this.transloco
      .selectTranslate('components.products.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateProductComponent,
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
      });
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  ngOnDestroy() {
    // Limpiar URLs de imágenes
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Limpiar URLs de videos
    Object.values(this.videoUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Limpiar suscripciones
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  async delete(data: any) {
    const deleteTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.products.delete.title'),
      this.transloco.selectTranslate('components.products.delete.message'),
      this.transloco.selectTranslate('components.products.delete.confirm'),
      this.transloco.selectTranslate('components.products.delete.cancel'),
    ]).pipe(take(1));

    const deleteActionsSubscription = deleteTranslation$.subscribe(
      async ([
        titleTranslation,
        messageTranslation,
        confirmTranslation,
        cancelTranslation,
      ]) => {
        const confirmed = await this.confirmDialogService.confirm({
          title: titleTranslation,
          message: messageTranslation,
          confirmLabel: confirmTranslation,
          cancelLabel: cancelTranslation,
        });

        if (confirmed) {
          this.loading = true;
          this.srv.delete(data.id).subscribe({
            next: () => {
              this.loadData();
              this.notificationSrv.addNotification(
                this.transloco.translate(
                  'notifications.products.success.deleted'
                ),
                'success'
              );
            },
            error: (error) => {
              if (
                error.error.statusCode === 400 &&
                error.error.message.includes('No se puede eliminar el producto')
              ) {
                this.notificationSrv.addNotification(
                  this.transloco.translate(
                    'notifications.products.error.cannotDelete'
                  ),
                  'error'
                );
              } else {
                this.notificationSrv.addNotification(
                  this.transloco.translate(
                    'notifications.products.error.delete'
                  ),
                  'error'
                );
              }
              this.loading = false;
            },
          });
        }
      }
    );
    this.subscriptions.push(deleteActionsSubscription);
  }

  toggleStatus(data: any) {
    const newStatus = !data.status;
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('status', String(newStatus));
    this.srv.patch(formData, data.id).subscribe({
      next: () => {
        data.status = newStatus;
        const statusText = newStatus ? this.activeStatus : this.inactiveStatus;

        // Notificación de éxito con traducción y parámetros
        const message = this.transloco.translate(
          'notifications.news.success.statusUpdated',
          { status: statusText }
        );
        this.notificationSrv.addNotification(message, 'success');

        // Actualizar la propiedad statusToShow para reflejar el cambio en la tabla sin recargar
        data.statusToShow = statusText;
      },
      error: (error) => {
        if (error?.error?.message && error.error?.statusCode === 400) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          // Notificación de error genérico con traducción
          this.translateAndNotify(
            'notifications.news.error.statusUpdate',
            'error'
          );
        }
      },
    });
  }

  private translateAndNotify(
    key: string,
    severity: 'success' | 'error' | 'info' | 'warn',
    params?: object
  ) {
    this.transloco
      .selectTranslate(key, params)
      .pipe(take(1))
      .subscribe((message) => {
        this.notificationSrv.addNotification(message, severity);
      });
  }
}
