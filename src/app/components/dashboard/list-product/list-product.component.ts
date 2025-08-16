import {
  Component,
  inject,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
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
            field: 'image',
            header: imageTranslation,
            width: '240px',
          },
        ];
      }
    );

    const rowsTranslation$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.delete'),
    ]);

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = rowsTranslation$.subscribe(
      ([editTranslation, deleteTranslation]) => {
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
    this.customTemplates['image'] = this.imageTemplate;
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

          return {
            ...item,
            categoryName: item.category.title,
            variantsText, // Nuevo campo para mostrar
          };
        });
        this.loading = false;

        data.forEach((item) => {
          if (item.photo) {
            const isVideo = item.photo.toLowerCase().endsWith('.mp4');
            this.srv.getImage(item.photo).subscribe({
              next: (fileBlob) => {
                if (isVideo) {
                  this.videoUrls[item.id] = URL.createObjectURL(fileBlob);
                } else {
                  this.imageUrls[item.id] = URL.createObjectURL(fileBlob);
                }
              },
              error: (error) => {
                this.notificationSrv.addNotification(
                  this.transloco.translate('notifications.products.error.loadImage'),
                  'error'
                );
              },
            });
          }
        });
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

  getVideoUrl(rowData: HomeData): string {
    return this.videoUrls[rowData.id] || '';
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

  getImageUrl(rowData: HomeData): string {
    return this.imageUrls[rowData.id] || '';
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
                this.transloco.translate('notifications.products.success.deleted'),
                'success'
              );
            },
            error: (error) => {
              if (
                error.error.statusCode === 400 &&
                error.error.message.includes('No se puede eliminar el producto')
              ) {
                this.notificationSrv.addNotification(
                  this.transloco.translate('notifications.products.error.cannotDelete'),
                  'error'
                );
              } else {
                this.notificationSrv.addNotification(
                  this.transloco.translate('notifications.products.error.delete'),
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
}
