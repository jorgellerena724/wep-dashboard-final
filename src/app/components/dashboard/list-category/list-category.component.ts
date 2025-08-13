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
import { HomeData } from '../../../shared/interfaces/home.interface';
import { CreateCategoryComponent } from '../create-category/create-category.component';
import { UpdateCategoryComponent } from '../update-category/update-category.component';
import { ConfirmDialogService } from '../../../shared/services/system/confirm-dialog.service';
import { CategoryService } from '../../../shared/services/features/category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { combineLatest, Subscription, take } from 'rxjs';

@Component({
  selector: 'app-list-category',
  imports: [CommonModule, TableComponent, ButtonModule, TranslocoModule],
  templateUrl: './list-category.component.html',
  standalone: true,
  providers: [],
})
export class ListCategoryComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private subscriptions: Subscription[] = [];
  data: HomeData[] = [];
  image: any;
  loading = false;

  columns: Column[] = [];

  // Definimos las acciones del encabezado
  headerActions: TableAction[] = [];

  // Definimos las acciones de fila
  rowActions: RowAction[] = [];

  constructor(
    private modalSrv: ModalService,
    private notificationSrv: NotificationService,
    private srv: CategoryService,
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
      this.transloco.selectTranslate('components.category.list.table.name'),
    ]);

    const columnsSubscription = columnsTranslation$.subscribe(
      ([nameTranslation]) => {
        this.columns = [
          {
            field: 'title',
            header: nameTranslation,
            sortable: true,
            filter: true,
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
      next: (data: HomeData[]) => {
        this.data = data;
        this.loading = false;
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
    this.loadData();
  }

  create() {
    this.transloco
      .selectTranslate('components.category.create.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: CreateCategoryComponent,
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
      .selectTranslate('components.category.edit.title')
      .pipe(take(1))
      .subscribe((translatedTitle) => {
        const modalConfig: ModalConfig = {
          title: translatedTitle,
          component: UpdateCategoryComponent,
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

  async delete(data: any) {
    const deleteTranslation$ = combineLatest([
      this.transloco.selectTranslate('components.category.delete.title'),
      this.transloco.selectTranslate('components.category.delete.message'),
      this.transloco.selectTranslate('components.category.delete.confirm'),
      this.transloco.selectTranslate('components.category.delete.cancel'),
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
                'Categoría eliminado satisfactoriamente.',
                'success'
              );
            },
            error: (error) => {
              if (
                error.error.statusCode === 400 &&
                error.error.message.includes(
                  'No se puede eliminar la categoría'
                )
              ) {
                this.notificationSrv.addNotification(
                  error.error.message,
                  'error'
                );
              } else {
                this.notificationSrv.addNotification(
                  'Error al eliminar la categoría.',
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
