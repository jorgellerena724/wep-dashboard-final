import { Observable } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  Column,
  TableAction,
  RowAction,
} from '../components/app-table/app.table.component';
import { HomeData } from './home.interface';

export interface MediaConfig {
  type: 'image' | 'video' | 'both';
  fieldName?: string;
  serviceMethod?: (fileName: string) => Observable<Blob>;
}

export interface OrderConfig {
  enabled: boolean;
  fieldName?: string;
  updateOrderMethod?: (id: number, order: number) => Observable<any>;
}

export interface StatusConfig {
  enabled: boolean;
  toggleMethod?: (id: number, status: boolean) => Observable<any>;
  minActiveItems?: number;
}

export interface ActionConfig {
  create?: {
    enabled: boolean;
    component?: any;
    translationKey?: string;
  };
  edit?: {
    enabled: boolean;
    component?: any;
    translationKey?: string;
  };
  delete?: {
    enabled: boolean;
    translationKey?: string;
    confirmDialog?: boolean;
    customErrorHandler?: (
      error: any,
      transloco: TranslocoService
    ) => string | null;
  };
  toggleStatus?: {
    enabled: boolean;
  };
}

export interface ListConfig<T = HomeData> {
  service: any;
  translationPrefix: string;
  columns: Column[] | ((transloco: TranslocoService) => Column[]);
  media?: MediaConfig;
  order?: OrderConfig;
  status?: StatusConfig;
  actions: ActionConfig;
  customRowActions?: (transloco: TranslocoService) => RowAction[];
  customHeaderActions?: (transloco: TranslocoService) => TableAction[];
  customTemplates?: { [key: string]: any };
  onRowClick?: (row: T) => void;
  beforeDelete?: (row: T) => Observable<boolean> | Promise<boolean> | boolean;
  afterRefresh?: () => void;
}
