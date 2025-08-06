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
import { HeaderService } from '../../../shared/services/features/header.service';
import { icons } from '../../../core/constants/icons.constant';
import { UpdateHeaderComponent } from '../update-header/update-header.component';
import { HeaderData } from '../../../shared/interfaces/headerData.interface';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-header',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-header.component.html',
  standalone: true,
  providers: [],
})
export class ListHeaderComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];

  data: HeaderData[] = [];
  image: any;
  loading = false;
  imageUrls: { [key: number]: string } = {};

  // Referencia al template de imagen
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
    private srv: HeaderService //private confirmDialogSrv:
  ) {}

  ngOnInit() {
    this.setupTranslations();
    this.loadData();
  }

  private setupTranslations() {
    // Suscribirse a los cambios de idioma para actualizar las columnas
    const columnsTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.header.list.table.name'),
      this.transloco.selectTranslate('components.header.list.table.image'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([nameTranslation, imageTranslation]) => {
        this.columns = [
          {
            field: 'name',
            header: nameTranslation,
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

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = this.transloco
      .selectTranslate('table.buttons.edit')
      .subscribe((editTranslation) => {
        this.rowActions = [
          {
            label: editTranslation,
            icon: icons['edit'],
            onClick: (data) => this.edit(data),
            class: buttonVariants.outline.green,
          },
        ];
      });

    this.subscriptions.push(columnsSubscription, rowActionsSubscription);
  }

  ngAfterViewInit() {
    // Asignar el template personalizado para el campo 'image'
    this.customTemplates['image'] = this.imageTemplate;
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data: HeaderData[]) => {
        this.data = data;
        this.loading = false;

        data.forEach((item) => {
          if (item.logo) {
            this.srv.getImage(item.logo).subscribe({
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
      .selectTranslate('components.header.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateHeaderComponent,
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

  getImageUrl(rowData: HeaderData): string {
    return this.imageUrls[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
    // O puedes mostrar una imagen por defecto:
    // event.target.src = 'assets/images/no-image.png';
  }

  ngOnDestroy() {
    Object.values(this.imageUrls).forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }
}
