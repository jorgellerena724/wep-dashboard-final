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
import { CompanyService } from '../../../../shared/services/features/company.service';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { UpdateCompanyComponent } from '../update-company/update-company.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-company',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-company.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCompanyComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(CompanyService);
  private destroyRef = inject(DestroyRef);

  // ViewChild signal
  imageTemplate = viewChild<TemplateRef<any>>('imageTemplate');

  // Signals para el estado
  data = signal<HomeData[]>([]);
  loading = signal<boolean>(false);
  imageUrls = signal<{ [key: number]: string }>({});

  // Computed signal para templates personalizados
  customTemplates = computed<{ [key: string]: any }>(() => {
    const imgTemplate = this.imageTemplate();
    const templates: { [key: string]: any } = {};

    if (imgTemplate) templates['image'] = imgTemplate;

    return templates;
  });

  // Computed signals para traducciones de estado
  activeStatus = computed(() =>
    this.transloco.translate('status.active').trim()
  );
  inactiveStatus = computed(() =>
    this.transloco.translate('status.inactive').trim()
  );

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    const nameTranslation = this.transloco.translate(
      'components.news.list.table.name'
    );
    const descriptionTranslation = this.transloco.translate(
      'components.news.list.table.description'
    );
    const statusTranslation = this.transloco.translate(
      'components.news.list.table.status'
    );
    const imageTranslation = this.transloco.translate(
      'components.news.list.table.image'
    );

    return [
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
  });

  headerActions = computed<TableAction[]>(() => []);

  rowActions = computed<RowAction[]>(() => {
    const editTranslation = this.transloco.translate('table.buttons.edit');
    const disableTranslation = this.transloco.translate(
      'table.buttons.disable'
    );
    const enableTranslation = this.transloco.translate('table.buttons.enable');

    return [
      {
        label: editTranslation,
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
      },
      {
        label: (data) => (data.status ? disableTranslation : enableTranslation),
        icon: (data) => (data.status ? icons['activate'] : icons['deactivate']),
        onClick: (data) => this.toggleStatus(data),
        class: (data) =>
          data.status
            ? buttonVariants.outline.gray
            : buttonVariants.outline.neutral,
      },
    ];
  });

  constructor() {
    // Cargar datos iniciales
    this.loadData();

    // Effect para recargar cuando cambie el idioma
    effect(() => {
      this.transloco.selectTranslate('table.buttons.edit');
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: HomeData[]) => {
          const active = this.activeStatus();
          const inactive = this.inactiveStatus();

          const processedData = data.map((item: any) => ({
            ...item,
            statusToShow: item.status ? active : inactive,
          }));

          this.data.set(processedData);
          this.loading.set(false);

          // Cargar las imágenes de las empresas
          this.loadCompanyImages(data);
        },
        error: (error) => {
          const message = this.transloco.translate(
            'notifications.company.error.load'
          );
          this.notificationSrv.addNotification(message, 'error');
          this.loading.set(false);
        },
      });
  }

  private loadCompanyImages(companies: HomeData[]): void {
    companies.forEach((item) => {
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
              const message = this.transloco.translate(
                'notifications.company.error.loadImage'
              );
              this.notificationSrv.addNotification(message, 'error');
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

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.company.edit.title'
    );

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
  }

  getImageUrl(rowData: HomeData): string {
    return this.imageUrls()[rowData.id] || '';
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  toggleStatus(data: any): void {
    const currentData = this.data();
    const newStatus = !data.status;
    const formData = new FormData();
    formData.append('id', data.id);
    formData.append('status', String(newStatus));

    this.srv
      .patch(formData, data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const active = this.activeStatus();
          const inactive = this.inactiveStatus();

          // Actualizar estado local inmutablemente
          const updatedData = currentData.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  status: newStatus,
                  statusToShow: newStatus ? active : inactive,
                }
              : item
          );

          this.data.set(updatedData);

          const statusText = newStatus ? active : inactive;
          const message = this.transloco.translate(
            'notifications.company.success.statusUpdated',
            { status: statusText }
          );
          this.notificationSrv.addNotification(message, 'success');
        },
        error: (error) => {
          if (error?.error?.message && error.error?.statusCode === 400) {
            this.notificationSrv.addNotification(
              error.error.message + '.',
              'error'
            );
          } else {
            const message = this.transloco.translate(
              'notifications.company.error.statusUpdate'
            );
            this.notificationSrv.addNotification(message, 'error');
          }
        },
      });
  }

  private cleanupBlobUrls(): void {
    const images = this.imageUrls();

    Object.values(images).forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }
}
