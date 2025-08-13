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
import { NewsService } from '../../../shared/services/features/news.service';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { UpdateNewsComponent } from '../update-news/update-news.component';
import { CreateNewsComponent } from '../create-news/create-news.component';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-news',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-news.component.html',
  standalone: true,
  providers: [],
})
export class ListNewsComponent implements OnInit {
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
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.delete'),
      this.transloco.selectTranslate('table.buttons.disable'),
      this.transloco.selectTranslate('table.buttons.enable'),
      this.transloco.selectTranslate('status.active'),
      this.transloco.selectTranslate('status.inactive'),
    ]);

    const setupSubscription = allTranslations$.subscribe(
      ([
        createTranslation,
        nameTranslation,
        descriptionTranslation,
        dateTranslation,
        statusTranslation,
        imageTranslation,
        editTranslation,
        deleteTranslation,
        disableTranslation,
        enableTranslation,
        activeStatusTranslation,
        inactiveStatusTranslation,
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
          { field: 'title', header: nameTranslation, sortable: true, filter: true },
          { field: 'description', header: descriptionTranslation, sortable: true, filter: true },
          { field: 'fecha', header: dateTranslation, sortable: true, filter: true },
          { field: 'statusToShow', header: statusTranslation, sortable: true, filter: true },
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
            label: (data) => (data.status ? disableTranslation : enableTranslation),
            icon: (data) => (data.status ? icons['activate'] : icons['deactivate']),
            onClick: (data) => this.toggleStatus(data),
            class: (data) => (data.status ? buttonVariants.outline.gray : buttonVariants.outline.neutral),
          },
        ];

        // Cargar los datos después de que todas las traducciones estén listas
        this.loadData();
      }
    );

    this.subscriptions.push(setupSubscription);
  }

  ngAfterViewInit() {
    // Asignar el template personalizado para el campo 'image'
    this.customTemplates['image'] = this.imageTemplate;
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
              error: (error) => {
                this.notificationSrv.addNotification('Error al cargar el archivo multimedia', 'error');
              },
            });
          }
        });
      },
      error: (error) => {
        this.notificationSrv.addNotification('Error al cargar la información."Error loading information."', 'error');
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

  toggleStatus(data: any) {
    const newStatus = !data.status;
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('status', String(newStatus));
    this.srv.patch(formData, data.id).subscribe({
      next: () => {
        data.status = newStatus;
        // Usar las propiedades con las traducciones para la notificación
        this.notificationSrv.addNotification(
          `Estado actualizado a ${newStatus ? this.activeStatus : this.inactiveStatus}`,
          'success'
        );
        // Actualizar la propiedad statusToShow para reflejar el cambio en la tabla sin recargar
        data.statusToShow = newStatus ? this.activeStatus : this.inactiveStatus;
      },
      error: (error) => {
        if (error?.error?.message && error.error?.statusCode === 400) {
          this.notificationSrv.addNotification(error.error.message + '.', 'error');
        } else {
          this.notificationSrv.addNotification('Error al actualizar el estado.', 'error');
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
              this.loadData();
              this.notificationSrv.addNotification('Novedad eliminada satisfactoriamente.', 'success');
            },
            error: (error) => {
              if (error.error.statusCode === 400 && error.error.message.includes('No se puede eliminar el producto')) {
                this.notificationSrv.addNotification(error.error.message, 'error');
              } else {
                this.notificationSrv.addNotification('Error al eliminar el producto.', 'error');
              }
              this.loading = false;
            },
          });
        }
      }
    );
    this.subscriptions.push(deleteActionsSubscription);
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