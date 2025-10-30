import {
  Component,
  Input,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  ViewEncapsulation,
  inject,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { ThemeService } from '../../../core/services/theme.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

export interface Column {
  field: string;
  header: string;
  sortable?: boolean;
  filter?: boolean;
  filterPlaceholder?: string;
  width?: string;
  defaultSort?: true;
}

export interface TableAction {
  label: string;
  icon: string;
  onClick: () => void;
  class?: string;
  isVisible?: () => boolean;
  isDisabled?: () => boolean;
}

export interface RowAction {
  label: string | ((data: any) => string);
  icon: string | ((data: any) => string);
  onClick: (rowData: any) => void;
  class?: string | ((data: any) => string);
  isVisible?: (rowData: any) => boolean;
  isDisabled?: (rowData: any) => boolean;
}

@Component({
  selector: 'app-table',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    MenuModule,
    TooltipModule,
    PaginatorModule,
    TranslocoModule,
  ],
  templateUrl: './app-table.component.html',
})
export class TableComponent implements OnInit {
  private transloco = inject(TranslocoService);
  isDark: boolean = false;
  @ViewChild('dt') dt!: Table;
  private _data: any[] = [];
  private filteredData: any[] = [];
  private originalData: any[] = [];
  @Input() defaultSortField: string = '';
  @Input() defaultSortOrder: number = 1;
  @Input()
  set data(value: any[]) {
    this._data = value || [];
    this.originalData = [...this._data]; // Mantener copia de los datos originales
    this.applyFilters(); // Aplicar filtros cuando cambian los datos
  }
  get data(): any[] {
    return this._data;
  }
  @Input() columns: Column[] = [];
  @Input() rowsPerPage = 10;
  @Input() loading = false;
  @Input() customTemplates: { [key: string]: any } = {};
  @Input() headerActions: TableAction[] = [];
  @Input() rowActions: RowAction[] = [];
  @Output() refresh = new EventEmitter();

  totalRecords: number = 0;
  displayedData: any[] = [];
  first: number = 0;
  columnFiltersForm!: FormGroup;
  showFilterInput: { [key: string]: boolean } = {};
  columnsWithActions: Column[] = [];
  rows: unknown;

  constructor(
    private themeService: ThemeService,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  private initializeForms() {
    this.columnFiltersForm = this.fb.group({});
  }

  ngOnChanges(changes: SimpleChanges) {
    // Detectar cambios en las columnas y re-inicializar si es necesario
    if (changes['columns'] && !changes['columns'].firstChange) {
      this.updateColumnsWithActions();
      this.setupColumnFilters();
    }

    if (changes['rowActions'] && !changes['rowActions'].firstChange) {
      this.updateColumnsWithActions();
    }
  }

  private updateColumnsWithActions() {
    this.transloco
      .selectTranslate('table.actions')
      .subscribe((translatedHeader) => {
        this.columnsWithActions =
          this.rowActions.length > 0
            ? [
                {
                  field: 'actions',
                  header: translatedHeader,
                  width: '150px',
                  defaultSort: true,
                },
                ...this.columns,
              ]
            : [...this.columns];
        this.cd.detectChanges();
      });
  }

  private setupColumnFilters() {
    const filterControls: any = {};
    this.columns.forEach((col) => {
      if (col.filter) {
        filterControls[col.field] = [''];
        this.showFilterInput[col.field] = false;
      }
    });

    this.columnFiltersForm = this.fb.group(filterControls);

    // Aplicar filtros cuando cambian
    Object.keys(this.columnFiltersForm.controls).forEach((field) => {
      this.columnFiltersForm.get(field)?.valueChanges.subscribe(() => {
        this.first = 0;
        this.applyFilters();
      });
    });
  }

  // Nuevo método para aplicar filtros
  private applyFilters() {
    // Copiar datos originales
    this.filteredData = [...this.originalData];

    // Aplicar filtros de columnas
    this.columns.forEach((col) => {
      if (col.filter && this.columnFiltersForm.get(col.field)?.value) {
        const searchTerm = this.columnFiltersForm
          .get(col.field)
          ?.value.toLowerCase();
        this.filteredData = this.filteredData.filter((item) =>
          String(item[col.field]).toLowerCase().includes(searchTerm)
        );
      }
    });

    // Actualizar métricas
    this.totalRecords = this.filteredData.length;
    this.updateDisplayedData();
  }

  clearFilter(field: string) {
    if (this.columnFiltersForm.get(field)) {
      this.columnFiltersForm.get(field)?.setValue('');
    }
    this.showFilterInput[field] = false;
  }

  getRowActionLabel(action: RowAction, rowData: any): string {
    return typeof action.label === 'function'
      ? action.label(rowData)
      : action.label;
  }
  isDarkMode() {
    return this.themeService.isDarkMode();
  }
  getRowActionIcon(action: RowAction, rowData: any): string {
    return typeof action.icon === 'function'
      ? action.icon(rowData)
      : action.icon;
  }

  getRowActionClass(action: RowAction, rowData: any): string {
    if (!action.class) return '';
    return typeof action.class === 'function'
      ? action.class(rowData)
      : action.class;
  }

  get globalFilterFields(): string[] {
    return this.columns.map((col) => col.field);
  }

  isFirstPage(): boolean {
    return this.first === 0;
  }

  isHeaderActionDisabled(action: TableAction): boolean {
    return action.isDisabled ? action.isDisabled() : false;
  }

  isHeaderActionVisible(action: TableAction): boolean {
    return action.isVisible ? action.isVisible() : true;
  }

  isLastPage(): boolean {
    return this.first + this.rowsPerPage >= this.data.length;
  }

  isRowActionDisabled(action: RowAction, rowData: any): boolean {
    return action.isDisabled ? action.isDisabled(rowData) : false;
  }

  isRowActionVisible(action: RowAction, rowData: any): boolean {
    return action.isVisible ? action.isVisible(rowData) : true;
  }

  next() {
    this.first += this.rowsPerPage;

    if (this.first >= this.data.length) {
      this.first = this.data.length - this.rowsPerPage;
    }
  }

  ngOnInit() {
    // Escuchar cambios en el modo oscuro
    this.themeService.darkMode$.subscribe((mode) => {
      this.isDark = mode;
      this.cd.detectChanges(); // Forzar actualización de Angular
    });

    // Lógica de inicialización del paginador
    this.transloco
      .selectTranslate('table.actions')
      .subscribe((translatedHeader) => {
        this.columnsWithActions = [
          {
            field: 'actions',
            header: translatedHeader,
            width: '150px',
            defaultSort: true,
          },
          ...this.columns,
        ];
        this.cd.detectChanges();
      });

    if (this.defaultSortField) {
      setTimeout(() => {
        this.dt.sortField = this.defaultSortField;
        this.dt.sortOrder = this.defaultSortOrder;
        this.dt.sortSingle();
      });
    }

    // Inicializar filtros de columnas
    const filterControls: any = {};
    this.columns.forEach((col) => {
      if (col.filter) {
        filterControls[col.field] = [''];
        this.showFilterInput[col.field] = false;
      }
    });
    this.columnFiltersForm = this.fb.group(filterControls);

    // Aplicar filtros cuando cambian
    Object.keys(this.columnFiltersForm.controls).forEach((field) => {
      this.columnFiltersForm.get(field)?.valueChanges.subscribe(() => {
        this.first = 0;
        this.applyFilters();
      });
    });
  }

  onPageChange(event: any) {
    this.first = event.first; // Actualiza el índice del primer elemento
    this.rowsPerPage = event.rows; // Actualiza el número de filas por página
    this.updateDisplayedData(); // Recorta los datos para mostrar solo los de la página actual
  }

  pageChange(event: any) {
    this.first = event.first;
    this.rowsPerPage = event.rows;
  }

  prev() {
    this.first -= this.rowsPerPage;

    if (this.first < 0) {
      this.first = 0;
    }
  }

  refreshData() {
    this.loading = true;
    this.refresh.emit();
  }

  reset() {
    this.first = 0;
  }

  toggleFilter(field: string) {
    this.showFilterInput[field] = !this.showFilterInput[field];
  }

  private updateDisplayedData() {
    this.displayedData = this.filteredData.slice(
      this.first,
      this.first + this.rowsPerPage
    );
  }

  // Trunca cadenas a un máximo de 'limit' caracteres
  truncate(value: any, limit: number = 30): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.length > limit ? str.slice(0, limit) + '…' : str;
  }
}
