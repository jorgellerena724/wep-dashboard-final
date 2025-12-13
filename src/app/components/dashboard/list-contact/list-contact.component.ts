import { Component, inject, OnInit } from '@angular/core';

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
import { ContactService } from '../../../shared/services/features/contact.service';
import { UpdateContactComponent } from '../update-contact/update-contact.component';
import { ContactData } from '../../../shared/interfaces/contact.interface';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-contact',
  imports: [TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-contact.component.html',
  standalone: true,
  providers: [],
})
export class ListContactComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: ContactData[] = [];
  image: any;
  loading = false;

  columns: Column[] = [
    {
      field: 'email',
      header: 'Correo',
      sortable: true,
      filter: true,
    },
    {
      field: 'phone',
      header: 'Teléfono',
      sortable: true,
      filter: true,
    },
    {
      field: 'address',
      header: 'Dirección',
      sortable: true,
      filter: true,
    },
  ];

  // Definimos las acciones del encabezado
  headerActions: TableAction[] = [];

  // Definimos las acciones de fila
  rowActions: RowAction[] = [
    {
      label: 'Editar',
      icon: icons['edit'],
      onClick: (data) => this.edit(data),
      class: buttonVariants.outline.green,
    },
  ];

  constructor(
    private modalSrv: ModalService,
    private notificationSrv: NotificationService,
    private srv: ContactService
  ) {}

  ngOnInit() {
    this.setupTranslations();
    this.loadData();
  }

  private setupTranslations() {
    // Suscribirse a los cambios de idioma para actualizar las columnas
    const columnsTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.contact.list.table.email'),
      this.transloco.selectTranslate('components.contact.list.table.phone'),
      this.transloco.selectTranslate('components.contact.list.table.address'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([emailTranslation, phoneTranslation, addressTranslation]) => {
        this.columns = [
          {
            field: 'email',
            header: emailTranslation,
            sortable: true,
            filter: true,
          },
          {
            field: 'phone',
            header: phoneTranslation,
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
      }
    );

    const rowsTranslation$ = combineLatest([
      this.transloco.selectTranslate('table.buttons.edit'),
    ]);

    // Suscribirse a los cambios de idioma para las acciones de fila
    const rowActionsSubscription = rowsTranslation$.subscribe(
      ([editTranslation]) => {
        this.rowActions = [
          {
            label: editTranslation,
            icon: icons['edit'],
            onClick: (data) => this.edit(data),
            class: buttonVariants.outline.green,
          },
        ];
      }
    );

    this.subscriptions.push(columnsSubscription, rowActionsSubscription);
  }

  loadData() {
    this.loading = true;
    this.srv.get().subscribe({
      next: (data: ContactData[]) => {
        this.data = data;
        this.loading = false;
      },
      error: (error) => {
        this.transloco.selectTranslate('notifications.contact.error.load').subscribe(message => {
          this.notificationSrv.addNotification(message, 'error');
        });
        this.loading = false;
      },
    });
  }

  onRefresh() {
    this.loadData();
  }

  edit(data: any) {
    this.transloco
      .selectTranslate('components.contact.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
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
      });
  }
}
