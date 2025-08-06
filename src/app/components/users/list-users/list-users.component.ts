import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-users',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-users.component.html',
  styleUrl: './list-users.component.css',
  standalone: true,
  providers: [UserService, ConfirmDialogService],
})
export class UsersComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: any[] = [];
  loading = false;

  columns: Column[] = [];

  // Definimos las acciones del encabezado
  headerActions: TableAction[] = [
    {
      label: 'Registrar Usuario',
      icon: icons['add'],
      onClick: () => this.create(),
      class: 'p-button-primary',
    },
  ];

  // Definimos las acciones de fila
  rowActions: RowAction[] = [
    {
      label: 'Cambiar contraseña',
      icon: icons['changePassword'],
      onClick: (data) => this.changePassword(data),
      class: buttonVariants.outline.blue,
    },
    {
      label: 'Editar',
      icon: icons['editUser'],
      onClick: (data) => this.edit(data),
      class: buttonVariants.outline.green,
    },
    {
      label: 'Eliminar',
      icon: icons['delete'],
      onClick: (data) => this.delete(data),
      class: buttonVariants.outline.red,
    },
  ];

  constructor(
    private srv: UserService,
    private confirmDialogService: ConfirmDialogService,
    private notificationSrv: NotificationService,
    private modalSrv: ModalService
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
      this.transloco.selectTranslate('components.users.list.table.name'),
      this.transloco.selectTranslate('components.users.list.table.email'),
      this.transloco.selectTranslate('components.users.list.table.client'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([nameTranslation, emailTranslation, clientTranslation]) => {
        this.columns = [
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
      }
    );

    const rowsTranslation$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.changePassword'),
      this.transloco.selectTranslate('table.buttons.edit'),
      this.transloco.selectTranslate('table.buttons.delete'),
    ]);

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = rowsTranslation$.subscribe(
      ([changePasswordTranslation, editTranslation, deleteTranslation]) => {
        this.rowActions = [
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
      }
    );

    this.subscriptions.push(
      headerActionsSubscription,
      columnsSubscription,
      rowActionsSubscription
    );
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
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
    this.loadData();
  }

  create() {
    this.transloco
      .selectTranslate('components.users.create.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
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
      });
  }

  edit(data: any) {
    this.transloco
      .selectTranslate('components.users.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
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
      });
  }

  changePassword(data: any) {
    this.transloco
      .selectTranslate('components.users.password.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
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
      });
  }

  async delete(data: any) {
    // Obtener el usuario autenticado del localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Verificar si el usuario a eliminar es el mismo que está autenticado
    if (data.id === currentUser.id) {
      this.notificationSrv.addNotification(
        'No puede eliminar su propio usuario mientras esté autenticado.',
        'warning'
      );
      return;
    }
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
                'Producto eliminado satisfactoriamente.',
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
                  'Error al eliminar el producto.',
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
