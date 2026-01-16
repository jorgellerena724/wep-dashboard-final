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
import { CategoryService } from '../../../../shared/services/features/category.service';
import { CreateEditCategoryComponent } from '../create-edit-category/create-edit-category.component';
import { Column } from '../../../../shared/components/app-table/app.table.component';

@Component({
  selector: 'app-list-category',
  imports: [BaseListComponent, TranslocoModule],
  templateUrl: './list-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListCategoryComponent {
  private transloco = inject(TranslocoService);
  private srv = inject(CategoryService);

  // Esperar a que las traducciones estén listas
  private translations = toSignal(this.transloco.events$);

  // Signal reactivo para el título
  title = computed(() => {
    // Dependencia en translations para forzar recalculo
    this.translations();
    return this.transloco.translate('components.category.list.title');
  });

  // Configuración del listado usando computed para traducciones reactivas
  config = computed<ListConfig<HomeData>>(() => {
    // Dependencia en translations para forzar recalculo
    this.translations();

    return {
      service: this.srv,
      translationPrefix: 'notifications.categories',

      // Columnas con función para traducciones reactivas
      columns: (transloco: TranslocoService): Column[] => [
        {
          field: 'title',
          header: transloco.translate('components.category.list.table.name'),
          sortable: true,
          filter: true,
        },
      ],

      // Acciones CRUD (solo las necesarias para categorías)
      actions: {
        create: {
          enabled: true,
          component: CreateEditCategoryComponent,
          translationKey: 'components.category.create.title',
        },
        edit: {
          enabled: true,
          component: CreateEditCategoryComponent,
          translationKey: 'components.category.edit.title',
        },
        delete: {
          enabled: true,
          confirmDialog: true,
          customErrorHandler: (error: any, transloco: TranslocoService) => {
            // Manejo específico para productos asociados
            if (
              error.status === 400 &&
              error.error?.detail?.includes(
                'No se puede eliminar la categoría porque tiene productos asociados.'
              )
            ) {
              return transloco.translate(
                'notifications.categories.error.productAsociated'
              );
            }
            // Retornar null para usar el manejo por defecto
            return null;
          },
        },
      },

      // No se incluyen: media, order, status (son opcionales)
    };
  });
}
