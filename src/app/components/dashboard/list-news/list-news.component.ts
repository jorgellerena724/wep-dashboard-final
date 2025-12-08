import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  TemplateRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';

import {
  TableComponent,
  Column,
  TableAction,
  RowAction,
} from '../../../shared/components/app-table/app.table.component';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { buttonVariants } from '../../../core/constants/button-variant.constant';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { icons } from '../../../core/constants/icons.constant';
import { NewsService } from '../../../shared/services/features/news.service';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { UpdateNewsComponent } from '../update-news/update-news.component';
import { CreateNewsComponent } from '../create-news/create-news.component';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-news',
  imports: [
    TableComponent,
    ButtonModule,
    TranslocoModule,
    TooltipModule
],
  templateUrl: './list-news.component.html',
  standalone: true,
  providers: [],
})
export class ListNewsComponent implements OnInit, OnDestroy, AfterViewInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: HomeData[] = [];
  image: any;
  loading = false;
  imageUrls: { [key: number]: string } = {};
  videoUrls: { [key: number]: string } = {};

  // Propiedades para almacenar las traducciones de los estados
  activeStatus = '';
  inactiveStatus = '';

  @ViewChild('imageTemplate', { static: true })
  imageTemplate!: TemplateRef<any>;

  @ViewChild('orderTemplate', { static: true })
  orderTemplate!: TemplateRef<any>;

  customTemplates: { [key: string]: TemplateRef<any> } = {};

  columns: Column[] = [];

  // Definimos las acciones del encabezado
  headerActions: TableAction[] = [];

  // Definimos las acciones de fila
  rowActions: RowAction[] = [];

  constructor(
    private modalSrv: ModalService,
    private notificationSrv: NotificationService,
    private srv: NewsService,
    private confirmDialogService: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.setupTranslations();
  }

  private setupTranslations() {
    // Unificar todas las suscripciones de traducción en una sola
    const allTranslations$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.create'),
      this.transloco.selectTranslate('components.news.list.table.name'),
      this.transloco.selectTranslate('components.news.list.table.description'),
      this.transloco.selectTranslate('components.news.list.table.date'),
      this.transloco.selectTranslate('components.news.list.table.status'),
      this.transloco.selectTranslate('components.news.list.table.image'),
      this.transloco.selectTranslate('components.news.list.table.order'),
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.delete'),
      this.transloco.selectTranslate('table.buttons.disable'),
      this.transloco.selectTranslate('table.buttons.enable'),
      this.transloco.selectTranslate('status.active'),
      this.transloco.selectTranslate('status.inactive'),
      this.transloco.selectTranslate('table.buttons.moveUp'),
      this.transloco.selectTranslate('table.buttons.moveDown'),
    ]);

    const setupSubscription = allTranslations$.subscribe(
      ([
        createTranslation,
        nameTranslation,
        descriptionTranslation,
        dateTranslation,
        statusTranslation,
        imageTranslation,
        orderTranslation,
        editTranslation,
        deleteTranslation,
        disableTranslation,
        enableTranslation,
        activeStatusTranslation,
        inactiveStatusTranslation,
        moveUpTranslation,
        moveDownTranslation,
      ]) => {
        // Asignar traducciones de estado y limpiar espacios
        this.activeStatus = activeStatusTranslation.trim();
        this.inactiveStatus = inactiveStatusTranslation.trim();

        // Configurar acciones del encabezado
        this.headerActions = [
          {
            label: createTranslation,
            icon: icons['add'],
            onClick: () => this.create(),
            class: 'p-button-primary',
          },
        ];

        // Configurar columnas de la tabla
        this.columns = [
          { field: 'order', header: orderTranslation, width: '80px' },
          {
            field: 'title',
            header: nameTranslation,
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
            field: 'fecha',
            header: dateTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'statusToShow',
            header: statusTranslation,
            sortable: true,
            filter: true,
          },
          { field: 'image', header: imageTranslation, width: '240px' },
        ];

        // Configurar acciones de fila
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

        // Cargar los datos después de que todas las traducciones estén listas
        this.loadData();
      }
    );

    this.subscriptions.push(setupSubscription);
  }

  ngAfterViewInit() {
    // Asignar los templates personalizados
    this.customTemplates['image'] = this.imageTemplate;
    this.customTemplates['order'] = this.orderTemplate;
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data: HomeData[]) => {
        this.data = data.map((item: any) => ({
          ...item,
          // Usar las propiedades con las traducciones de estado
          statusToShow: item.status ? this.activeStatus : this.inactiveStatus,
        }));
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
              error: () => {
                // Notificación con traducción
                this.translateAndNotify(
                  'notifications.news.error.loadImage',
                  'error'
                );
              },
            });
          }
        });
      },
      error: () => {
        // Notificación con traducción
        this.translateAndNotify('notifications.news.error.load', 'error');
        this.loading = false;
      },
    });
  }

  onRefresh() {
    this.cleanupBlobUrls();
    this.imageUrls = {};
    this.videoUrls = {};
    this.loadData();
  }

  getVideoUrl(rowData: HomeData): string {
    return this.videoUrls[rowData.id] || '';
  }

  isFirstItem(rowData: HomeData): boolean {
    return this.data.findIndex((item) => item.id === rowData.id) === 0;
  }

  isLastItem(rowData: HomeData): boolean {
    return (
      this.data.findIndex((item) => item.id === rowData.id) ===
      this.data.length - 1
    );
  }

  create() {
    this.transloco
      .selectTranslate('components.news.create.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: CreateNewsComponent,
          data: {
            initialData: {
              onSave: () => {
                this.onRefresh();
              },
            },
          },
        };
        this.modalSrv.open(modalConfig);
      });
  }

  edit(data: any) {
    this.transloco
      .selectTranslate('components.news.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateNewsComponent,
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
      });
  }

  getImageUrl(rowData: HomeData): string {
    return this.imageUrls[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
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

  async delete(data: any) {
    const deleteTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.news.delete.title'),
      this.transloco.selectTranslate('components.news.delete.message'),
      this.transloco.selectTranslate('components.news.delete.confirm'),
      this.transloco.selectTranslate('components.news.delete.cancel'),
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
              this.onRefresh();
              // Notificación de éxito con traducción
              this.translateAndNotify(
                'notifications.news.success.deleted',
                'success'
              );
            },
            error: (error) => {
              if (error?.error?.message && error.error?.statusCode === 400) {
                this.notificationSrv.addNotification(
                  error.error.message,
                  'error'
                );
              } else {
                // Notificación de error genérico con traducción
                this.translateAndNotify(
                  'notifications.news.error.delete',
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

  moveNewsUp(data: any) {
    const currentIndex = this.data.findIndex((item) => item.id === data.id);

    if (currentIndex === 0) {
      return; // Ya es la primera
    }

    const currentItem = this.data[currentIndex];
    const previousItem = this.data[currentIndex - 1];

    // Obtener los valores de order actuales (usar índice como fallback si order es undefined)
    const currentOrder = currentItem.order ?? currentIndex;
    const previousOrder = previousItem.order ?? currentIndex - 1;

    // Intercambiar posiciones en el array local
    this.data[currentIndex] = previousItem;
    this.data[currentIndex - 1] = currentItem;

    // Actualizar el orden en el backend: el elemento actual recibe el order menor (del anterior)
    // y el anterior recibe el order mayor (del actual)
    this.updateBothNewsOrder(
      currentItem.id,
      previousOrder,
      previousItem.id,
      currentOrder
    );
  }

  moveNewsDown(data: any) {
    const currentIndex = this.data.findIndex((item) => item.id === data.id);

    if (currentIndex === this.data.length - 1) {
      return; // Ya es la última
    }

    const currentItem = this.data[currentIndex];
    const nextItem = this.data[currentIndex + 1];

    // Obtener los valores de order actuales (usar índice como fallback si order es undefined)
    const currentOrder = currentItem.order ?? currentIndex;
    const nextOrder = nextItem.order ?? currentIndex + 1;

    // Intercambiar posiciones en el array local
    this.data[currentIndex] = nextItem;
    this.data[currentIndex + 1] = currentItem;

    // Actualizar el orden en el backend: el elemento actual recibe el order mayor (del siguiente)
    // y el siguiente recibe el order menor (del actual)
    this.updateBothNewsOrder(
      currentItem.id,
      nextOrder,
      nextItem.id,
      currentOrder
    );
  }

  private updateBothNewsOrder(
    id1: number,
    order1: number,
    id2: number,
    order2: number
  ) {
    // Actualizar ambas noticias en paralelo
    const update1$ = this.srv.updateOrder(id1, order1);
    const update2$ = this.srv.updateOrder(id2, order2);

    // Esperar a que ambas actualizaciones terminen
    combineLatest([update1$, update2$]).subscribe({
      next: (responses) => {
        // Recargar los datos para asegurar que el orden es correcto
        this.onRefresh();
        // Notificación de éxito con traducción
        this.translateAndNotify(
          'notifications.news.success.orderUpdated',
          'success'
        );
      },
      error: (error) => {
        // Si hay error, recargar los datos para restaurar el orden correcto
        this.onRefresh();
        if (error?.error?.message && error.error?.statusCode === 400) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          // Notificación de error genérico con traducción
          this.translateAndNotify(
            'notifications.news.error.orderUpdate',
            'error'
          );
        }
      },
    });
  }

  /**
   * Método auxiliar para traducir una clave y mostrar una notificación.
   * @param key - La clave de traducción del fichero JSON.
   * @param severity - El tipo de notificación ('success', 'error', 'info', 'warn').
   * @param params - Un objeto con parámetros para la traducción (opcional).
   */
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

  private cleanupBlobUrls() {
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    Object.values(this.videoUrls).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.cleanupBlobUrls();
  }
}
