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
} from '../../../shared/components/app-table/app.table.component';
import { UserService } from '../../../shared/services/users/user.service';
import { CreateUserComponent } from '../create-user/create-user.component';
import { ButtonModule } from 'primeng/button';
import { buttonVariants } from '../../../core/constants/button-variant.constant';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
import { ChangeUserPasswordComponent } from '../change-user-password/change-user-password.component';
import { UpdateUserComponent } from '../update-user/update-user.component';
import { icons } from '../../../core/constants/icons.constant';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-list-users',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-users.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private srv = inject(UserService);
  private confirmDialogService = inject(ConfirmDialogService);
  private notificationSrv = inject(NotificationService);
  private modalSrv = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  // Signals para el estado
  data = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Computed signals para traducciones reactivas
  columns = computed<Column[]>(() => {
    const nameTranslation = this.transloco.translate(
      'components.users.list.table.name'
    );
    const emailTranslation = this.transloco.translate(
      'components.users.list.table.email'
    );
    const clientTranslation = this.transloco.translate(
      'components.users.list.table.client'
    );

    return [
      {
        field: 'full_name',
        header: nameTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'email',
        header: emailTranslation,
        sortable: true,
        filter: true,
      },
      {
        field: 'client',
        header: clientTranslation,
        sortable: true,
        filter: true,
      },
    ];
  });

  headerActions = computed<TableAction[]>(() => {
    const createTranslation = this.transloco.translate('table.buttons.create');

    return [
      {
        label: createTranslation,
        icon: icons['add'],
        onClick: () => this.create(),
        class: 'p-button-primary',
      },
    ];
  });

  rowActions = computed<RowAction[]>(() => {
    const changePasswordTranslation = this.transloco.translate(
      'table.buttons.changePassword'
    );
    const editTranslation = this.transloco.translate('table.buttons.edit');
    const deleteTranslation = this.transloco.translate('table.buttons.delete');

    return [
      {
        label: changePasswordTranslation,
        icon: icons['changePassword'],
        onClick: (data) => this.changePassword(data),
        class: buttonVariants.outline.blue,
      },
      {
        label: editTranslation,
        icon: icons['editUser'],
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
  });

  // Computed para mensajes de error
  loadErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.load')
  );

  selfDeleteErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.selfDelete')
  );

  deleteSuccessMessage = computed(() =>
    this.transloco.translate('notifications.users.success.deleted')
  );

  deleteErrorMessage = computed(() =>
    this.transloco.translate('notifications.users.error.delete')
  );

  createTitleMessage = computed(() =>
    this.transloco.translate('components.users.create.title')
  );

  editTitleMessage = computed(() =>
    this.transloco.translate('components.users.edit.title')
  );

  changePasswordTitleMessage = computed(() =>
    this.transloco.translate('components.users.password.title')
  );

  deleteTitleMessage = computed(() =>
    this.transloco.translate('components.products.delete.title')
  );

  deleteMessageMessage = computed(() =>
    this.transloco.translate('components.products.delete.message')
  );

  deleteConfirmMessage = computed(() =>
    this.transloco.translate('components.products.delete.confirm')
  );

  deleteCancelMessage = computed(() =>
    this.transloco.translate('components.products.delete.cancel')
  );

  constructor() {
    // Cargar datos iniciales
    this.loadData();

    // Effect para recargar cuando cambie el idioma
    effect(() => {
      // Acceder a las computed properties para que se activen las dependencias
      this.columns();
      this.headerActions();
      this.rowActions();
    });
  }

  loadData(): void {
    this.loading.set(true);

    this.srv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
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

  create(): void {
    const modalConfig: ModalConfig = {
      title: this.createTitleMessage(),
      component: CreateUserComponent,
      data: {
        initialData: {
          onSave: () => {
            this.loadData();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  edit(data: any): void {
    const modalConfig: ModalConfig = {
      title: this.editTitleMessage(),
      component: UpdateUserComponent,
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

  changePassword(data: any): void {
    const modalConfig: ModalConfig = {
      title: this.changePasswordTitleMessage(),
      component: ChangeUserPasswordComponent,
      data: {
        initialData: {
          id: data.id,
          email: data.email,
          onSave: () => {
            this.loadData();
          },
          closeOnSubmit: true,
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  async delete(data: any): Promise<void> {
    // Obtener el usuario autenticado del localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Verificar si el usuario a eliminar es el mismo que está autenticado
    if (data.id === currentUser.id) {
      this.notificationSrv.addNotification(
        this.selfDeleteErrorMessage(),
        'warning'
      );
      return;
    }

    const confirmed = await this.confirmDialogService.confirm({
      title: this.deleteTitleMessage(),
      message: this.deleteMessageMessage(),
      confirmLabel: this.deleteConfirmMessage(),
      cancelLabel: this.deleteCancelMessage(),
    });

    if (confirmed) {
      this.loading.set(true);

      this.srv
        .delete(data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.loadData();
            this.notificationSrv.addNotification(
              this.deleteSuccessMessage(),
              'success'
            );
          },
          error: (error) => {
            if (
              error.error.statusCode === 400 &&
              error.error.message.includes('No se puede eliminar el producto')
            ) {
              this.notificationSrv.addNotification(
                error.error.message,
                'error'
              );
            } else {
              this.notificationSrv.addNotification(
                this.deleteErrorMessage(),
                'error'
              );
            }
            this.loading.set(false);
          },
        });
    }
  }
}
