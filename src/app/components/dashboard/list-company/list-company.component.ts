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
import { CompanyService } from '../../../shared/services/features/company.service';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { UpdateCompanyComponent } from '../update-company/update-company.component';
import { combineLatest, Subscription, take } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-list-company',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-company.component.html',
  standalone: true,
  providers: [],
})
export class ListCompanyComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: HomeData[] = [];
  image: any;
  loading = false;
  imageUrls: { [key: number]: string } = {};

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
    private srv: CompanyService
  ) {}

  ngOnInit() {
    this.setupTranslations();
  }

  private setupTranslations() {
    // Suscribirse a los cambios de idioma para actualizar todo el texto dinámico
    const setupSubscription$ = combineLatest([
      this.transloco.selectTranslate('components.news.list.table.name'),
      this.transloco.selectTranslate('components.news.list.table.description'),
      this.transloco.selectTranslate('components.news.list.table.status'),
      this.transloco.selectTranslate('components.news.list.table.image'),
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.disable'),
      this.transloco.selectTranslate('table.buttons.enable'),
      this.transloco.selectTranslate('status.active'), // Añadido
      this.transloco.selectTranslate('status.inactive'), // Añadido
    ]);

    const setupSubscription = setupSubscription$.subscribe(
      ([
        nameTranslation,
        descriptionTranslation,
        statusTranslation,
        imageTranslation,
        editTranslation,
        disableTranslation,
        enableTranslation,
        activeStatusTranslation,
        inactiveStatusTranslation,
      ]) => {
        // Asignar traducciones de estado y limpiar espacios extra
        this.activeStatus = activeStatusTranslation.trim();
        this.inactiveStatus = inactiveStatusTranslation.trim();

        // Asignar traducciones de columnas
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
            field: 'statusToShow',
            header: statusTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'image',
            header: imageTranslation,
            width: '240px',
          },
        ];

        // Asignar traducciones de acciones de fila
        this.rowActions = [
          {
            label: editTranslation,
            icon: icons['edit'],
            onClick: (data) => this.edit(data),
            class: buttonVariants.outline.green,
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

        // Cargar los datos solo después de que las traducciones estén listas
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
            this.srv.getImage(item.photo).subscribe({
              next: (imageBlob) => {
                this.imageUrls[item.id] = URL.createObjectURL(imageBlob);
              },
              error: (error) => {
                this.transloco.selectTranslate('notifications.company.error.loadImage').subscribe(message => {
                  this.notificationSrv.addNotification(message, 'error');
                });
              },
            });
          }
        });
      },
      error: (error) => {
        this.transloco.selectTranslate('notifications.company.error.load').subscribe(message => {
          this.notificationSrv.addNotification(message, 'error');
        });
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

  edit(data: any) {
    this.transloco
      .selectTranslate('components.company.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateCompanyComponent,
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
        const statusText = newStatus ? this.activeStatus : this.inactiveStatus;
        this.transloco.selectTranslate('notifications.company.success.statusUpdated', { status: statusText }).subscribe(message => {
          this.notificationSrv.addNotification(message, 'success');
        });
        // Actualizar la propiedad statusToShow para reflejar el cambio en la tabla sin recargar
        data.statusToShow = newStatus ? this.activeStatus : this.inactiveStatus;
      },
      error: (error) => {
        if (error?.error?.message && error.error?.statusCode === 400) {
          this.notificationSrv.addNotification(
            error.error.message + '.',
            'error'
          );
        } else {
          this.transloco.selectTranslate('notifications.company.error.statusUpdate').subscribe(message => {
            this.notificationSrv.addNotification(message, 'error');
          });
        }
      },
    });
  }

  ngOnDestroy() {
    // Cancelar todas las suscripciones para evitar fugas de memoria
    this.subscriptions.forEach((sub) => sub.unsubscribe());

    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }
}