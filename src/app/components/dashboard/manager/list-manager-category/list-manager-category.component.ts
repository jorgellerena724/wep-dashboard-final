import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { BaseListComponent } from '../../../../shared/components/app-base-list/app-base-list.component';
import { ListConfig } from '../../../../shared/interfaces/list-config.interface';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { ManagerCategoryService } from '../../../../shared/services/features/manager-category.service';
import { CreateEditManagerCategoryComponent } from '../create-edit-manager-category/create-edit-manager-category.component';
import { Column } from '../../../../shared/components/app-table/app.table.component';

@Component({
  selector: 'app-list-manager-category',
  imports: [BaseListComponent, TranslocoModule],
  templateUrl: './list-manager-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListManagerCategoryComponent {
  private transloco = inject(TranslocoService);
  private srv = inject(ManagerCategoryService);

  // Esperar a que las traducciones estén listas
  private translations = toSignal(this.transloco.events$);

  // Signal reactivo para el título
  title = computed(() => {
    this.translations();
    return this.transloco.translate('components.manager-category.list.title');
  });

  // Configuración del listado
  config = computed<ListConfig<HomeData>>(() => {
    this.translations();

    return {
      service: this.srv,
      translationPrefix: 'notifications.manager-category',

      columns: (transloco: TranslocoService): Column[] => [
        {
          field: 'title',
          header: transloco.translate(
            'components.manager-category.list.table.name'
          ),
          sortable: true,
          filter: true,
        },
      ],

      actions: {
        create: {
          enabled: true,
          component: CreateEditManagerCategoryComponent,
          translationKey: 'components.manager-category.create.title',
        },
        edit: {
          enabled: true,
          component: CreateEditManagerCategoryComponent,
          translationKey: 'components.manager-category.edit.title',
        },
        delete: {
          enabled: true,
          confirmDialog: true,
          customErrorHandler: (error: any, transloco: TranslocoService) => {
            // Manejo específico para cuando no se puede eliminar
            if (
              error.error?.statusCode === 400 &&
              error.error?.message?.includes(
                'No se puede eliminar la categoría'
              )
            ) {
              return error.error.message;
            }
            return null;
          },
        },
      },
    };
  });
}
