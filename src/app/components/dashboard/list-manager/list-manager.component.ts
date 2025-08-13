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
import { ManagerService } from '../../../shared/services/features/manager.service';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { UpdateManagerComponent } from '../update-manager/update-manager.component';
import { CreateManagerComponent } from '../create-manager/create-manager.component';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-manager',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-manager.component.html',
  standalone: true,
  providers: [],
})
export class ListManagerComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: HomeData[] = [];
  image: any;
  loading = false;
  imageUrls: { [key: number]: string } = {};

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
    private srv: ManagerService,
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
      this.transloco.selectTranslate('components.managers.list.table.name'),
      this.transloco.selectTranslate(
        'components.managers.list.table.description'
      ),
      this.transloco.selectTranslate('components.managers.list.table.charge'),
      this.transloco.selectTranslate('components.managers.list.table.image'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([
        nameTranslation,
        descriptionTranslation,
        chargeTranslation,
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
            field: 'description',
            header: descriptionTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'charge',
            header: chargeTranslation,
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
            isVisible: () => this.visible(),
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
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data: HomeData[]) => {
        this.data = data;
        this.loading = false;

        data.forEach((item) => {
          if (item.photo) {
            this.srv.getImage(item.photo).subscribe({
              next: (imageBlob) => {
                this.imageUrls[item.id] = URL.createObjectURL(imageBlob);
              },
              error: (error) => {
                this.notificationSrv.addNotification(
                  'Error al cargar imagen."Error loading image"',
                  'error'
                );
              },
            });
          }
        });
      },
      error: (error) => {
        this.notificationSrv.addNotification(
          'Error al cargar la información."Error loading information."',
          'error'
        );
        this.loading = false;
      },
    });
  }

  onRefresh() {
    // Limpiar URLs de imágenes anteriores para evitar memory leaks
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.imageUrls = {};
    this.loadData();
  }

  create() {
    this.transloco
      .selectTranslate('components.managers.create.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: CreateManagerComponent,
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
      .selectTranslate('components.managers.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateManagerComponent,
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
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  async delete(data: any) {
    const deleteTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.managers.delete.title'),
      this.transloco.selectTranslate('components.managers.delete.message'),
      this.transloco.selectTranslate('components.managers.delete.confirm'),
      this.transloco.selectTranslate('components.managers.delete.cancel'),
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
                'Directivo eliminado satisfactoriamente.',
                'success'
              );
            },
            error: (error) => {
              if (
                error.error.statusCode === 400 &&
                error.error.message.includes(
                  'No se puede eliminar el directivo'
                )
              ) {
                this.notificationSrv.addNotification(
                  error.error.message,
                  'error'
                );
              } else {
                this.notificationSrv.addNotification(
                  'Error al eliminar el directivo.',
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

  visible(): boolean {
    return this.data.length !== 1;
  }
}
