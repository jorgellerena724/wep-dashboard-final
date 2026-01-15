import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {
  ModalService,
  ModalConfig,
} from '../../../../shared/services/system/modal.service';
import { HeaderService } from '../../../../shared/services/features/header.service';
import { HeaderData } from '../../../../shared/interfaces/headerData.interface';
import { TranslocoService, TranslocoModule } from '@jsverse/transloco';
import { ListConfig } from '../../../../shared/interfaces/list-config.interface';
import { BaseListComponent } from '../../../../shared/components/app-base-list/app-base-list.component';
import { UpdateHeaderComponent } from '../update-header/update-header.component';
import { icons } from '../../../../core/constants/icons.constant';
import { buttonVariants } from '../../../../core/constants/button-variant.constant';

@Component({
  selector: 'app-list-header',
  imports: [BaseListComponent, TranslocoModule],
  templateUrl: './list-header.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListHeaderComponent implements OnInit {
  private srv = inject(HeaderService);
  private transloco = inject(TranslocoService);
  private modalSrv = inject(ModalService);

  imageTemplate = viewChild.required<TemplateRef<any>>('imageTemplate');
  baseListComponent = viewChild.required(BaseListComponent<HeaderData>);

  listConfig = signal<ListConfig<HeaderData>>({} as ListConfig<HeaderData>);

  ngOnInit(): void {
    this.listConfig.set({
      service: this.srv,
      translationPrefix: 'notifications.header',
      columns: (
        transloco: TranslocoService
      ): import('../../../../shared/components/app-table/app.table.component').Column[] => [
        {
          field: 'name',
          header: transloco.translate('components.header.list.table.name'),
          sortable: true,
          filter: true,
        },
        {
          field: 'image',
          header: transloco.translate('components.header.list.table.image'),
          width: '240px',
        },
      ],
      actions: {
        edit: {
          enabled: false, // Desactivar el botón de edición por defecto
          component: UpdateHeaderComponent,
          translationKey: 'components.header.edit.title',
        },
      },
      customRowActions: (transloco: TranslocoService) => [
        {
          label: transloco.translate('table.buttons.edit'),
          icon: icons['edit'],
          class: buttonVariants.outline.green,
          onClick: (data: any) => this.edit(data),
        },
      ],
      media: {
        type: 'image',
        serviceMethod: (fileName: string) => this.srv.getImage(fileName),
        fieldName: 'logo',
      },
      customTemplates: {
        image: this.imageTemplate(),
      },
      order: { enabled: false },
      status: { enabled: false },
    });
  }

  getImageUrl(rowData: HeaderData): string {
    return this.baseListComponent().getMediaUrl(rowData.id) || '';
  }

  edit(data: any): void {
    const translatedTitle = this.transloco.translate(
      'components.header.edit.title'
    );

    const modalConfig: ModalConfig = {
      title: translatedTitle,
      component: UpdateHeaderComponent,
      data: {
        initialData: {
          ...data,
          onSave: () => {
            this.baseListComponent().onRefresh();
          },
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }
}
