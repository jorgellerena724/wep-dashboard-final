import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
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
import { ContactService } from '../../../../shared/services/features/contact.service';
import { UpdateContactComponent } from '../update-contact/update-contact.component';
import { ContactData } from '../../../../shared/interfaces/contact.interface';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-contact',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-contact.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListContactComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);
  private notificationSrv = inject(NotificationService);
  private srv = inject(ContactService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<ContactData[]>([]);
  loading = signal<boolean>(false);

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    const emailTranslation = this.transloco.translate(
      'components.contact.list.table.email'
    );
    const addressTranslation = this.transloco.translate(
      'components.contact.list.table.address'
    );

    return [
      {
        field: 'email',
        header: emailTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'address',
        header: addressTranslation,
        sortable: true,
        filter: true,
      },
    ];
  });

  headerActions = computed<TableAction[]>(() => []);

  rowActions = computed<RowAction[]>(() => {
    const editTranslation = this.transloco.translate('table.buttons.edit');

    return [
      {
        label: editTranslation,
        icon: icons['edit'],
        onClick: (data) => this.edit(data),
        class: buttonVariants.outline.green,
      },
    ];
  });

  // Computed para mensajes de error
  loadErrorMessage = computed(() =>
    this.transloco.translate('notifications.contact.error.load')
  );

  editTitleMessage = computed(() =>
    this.transloco.translate('components.contact.edit.title')
  );

  constructor() {
    // Cargar datos iniciales
    this.loadData();

    // Effect para recargar cuando cambie el idioma
    effect(() => {
      // Acceder a las computed properties para que se activen las dependencias
      this.columns();
      this.rowActions();
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: ContactData[]) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error) => {
          this.notificationSrv.addNotification(
            this.loadErrorMessage(),
            'error'
          );
          this.loading.set(false);
        },
      });
  }

  onRefresh(): void {
    this.loadData();
  }

  edit(data: any): void {
    const modalConfig: ModalConfig = {
      title: this.editTitleMessage(),
      component: UpdateContactComponent,
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
}
