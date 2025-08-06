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
    this.loadData();
  }

  private setupTranslations() {
    // Suscribirse a los cambios de idioma para actualizar las columnas
    const columnsTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.news.list.table.name'),
      this.transloco.selectTranslate('components.news.list.table.description'),
      this.transloco.selectTranslate('components.news.list.table.status'),
      this.transloco.selectTranslate('components.news.list.table.image'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([
        nameTranslation,
        descriptionTranslation,
        statusTranslation,
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
      }
    );

    const rowsTranslation$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.disable'),
      this.transloco.selectTranslate('table.buttons.enable'),
    ]);

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = rowsTranslation$.subscribe(
      ([editTranslation, disableTranslation, enableTranslation]) => {
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
      }
    );

    this.subscriptions.push(columnsSubscription, rowActionsSubscription);
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
          statusToShow: item.status ? 'Activado' : 'Desactivado',
        }));
        this.loading = false;

        data.forEach((item) => {
          if (item.photo) {
            this.srv.getImage(item.photo).subscribe({
              next: (imageBlob) => {
                this.imageUrls[item.id] = URL.createObjectURL(imageBlob);
              },
              error: (error) => {
                this.notificationSrv.addNotification(
                  'Error al cargar imagen',
                  'error'
                );
              },
            });
          }
        });
      },
      error: (error) => {
        this.notificationSrv.addNotification(
          'Error al cargar la información.',
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

  ngOnDestroy() {
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  toggleStatus(data: any) {
    const newStatus = !data.status;
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('status', String(newStatus));
    this.srv.patch(formData, data.id).subscribe({
      next: () => {
        data.status = newStatus;
        this.notificationSrv.addNotification(
          `Estado actualizado a ${newStatus ? 'Activo' : 'Inactivo'}`,
          'success'
        );
      },
      error: (error) => {
        if (error?.error?.message && error.error?.statusCode === 400) {
          this.notificationSrv.addNotification(
            error.error.message + '.',
            'error'
          );
        } else {
          this.notificationSrv.addNotification(
            'Error al actualizar el estado.',
            'error'
          );
        }
      },
    });
  }
}
