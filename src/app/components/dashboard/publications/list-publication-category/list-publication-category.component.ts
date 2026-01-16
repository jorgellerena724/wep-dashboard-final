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
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { CreateEditPublicationCategoryComponent } from '../create-edit-publication-category/create-edit-publication-category.component';
import { Column } from '../../../../shared/components/app-table/app.table.component';

@Component({
  selector: 'app-list-publication-category',
  imports: [BaseListComponent, TranslocoModule],
  templateUrl: './list-publication-category.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPublicationCategoryComponent {
  private transloco = inject(TranslocoService);
  private srv = inject(PublicationCategoryService);

  // Esperar a que las traducciones estén listas
  private translations = toSignal(this.transloco.events$);

  // Signal reactivo para el título
  title = computed(() => {
    this.translations();
    return this.transloco.translate(
      'components.publication-category.list.title'
    );
  });

  // Configuración del listado
  config = computed<ListConfig<HomeData>>(() => {
    this.translations();

    return {
      service: this.srv,
      translationPrefix: 'notifications.publication-category',

      columns: (transloco: TranslocoService): Column[] => [
        {
          field: 'title',
          header: transloco.translate(
            'components.publication-category.list.table.name'
          ),
          sortable: true,
          filter: true,
        },
      ],

      actions: {
        create: {
          enabled: true,
          component: CreateEditPublicationCategoryComponent,
          translationKey: 'components.publication-category.create.title',
        },
        edit: {
          enabled: true,
          component: CreateEditPublicationCategoryComponent,
          translationKey: 'components.publication-category.edit.title',
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
