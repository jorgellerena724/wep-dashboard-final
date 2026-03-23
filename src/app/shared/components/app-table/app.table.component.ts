import {
  Component,
  input,
  output,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class TableComponent {
  private transloco = inject(TranslocoService);
  private themeService = inject(ThemeService);
  private fb = inject(FormBuilder);

  private actionsHeaderLabel = toSignal(
    this.transloco.selectTranslate('table.actions'),
    { initialValue: 'Actions' },
  );
  isDark = toSignal(this.themeService.darkMode$, { initialValue: false });

  // Inputs
  data = input<any[]>([]);
  columns = input<Column[]>([]);
  rowsPerPage = input<number>(10);
  loading = input<boolean>(false);
  customTemplates = input<{ [key: string]: any }>({});
  headerActions = input<TableAction[]>([]);
  rowActions = input<RowAction[]>([]);
  defaultSortField = input<string>('');
  defaultSortOrder = input<number>(1);

  refresh = output<void>();

  dt = viewChild<Table>('dt');

  // State signals (isDark ya no está aquí porque es un toSignal arriba)
  originalData = signal<any[]>([]);
  filteredData = signal<any[]>([]);
  displayedData = signal<any[]>([]);
  totalRecords = signal<number>(0);
  first = signal<number>(0);
  showFilterInput = signal<{ [key: string]: boolean }>({});

  columnFiltersForm: FormGroup;

  // Computed signals
  columnsWithActions = computed<Column[]>(() => {
    const rowActionsArray = this.rowActions();
    const columnsArray = this.columns();

    // AHORA LEEMOS LA SIGNAL DE TRADUCCIÓN
    // Al leer actionsHeaderLabel(), Angular crea una dependencia.
    // Cuando Transloco termine de cargar, esta signal cambia y el computed se re-ejecuta solo.
    const translatedHeader = this.actionsHeaderLabel();

    if (rowActionsArray.length > 0) {
      return [
        {
          field: 'actions',
          header: translatedHeader || 'Actions', // Fallback seguro
          width: '150px',
          defaultSort: true,
        },
        ...columnsArray,
      ];
    }
    return [...columnsArray];
  });

  // ... Resto de computed signals ...

  constructor() {
    this.columnFiltersForm = this.fb.group({});

    // NOTA: He eliminado el effect del darkMode porque lo sustituí por toSignal arriba.
    // Es mucho más limpio y "Zoneless friendly".

    // Effect para actualizar datos
    effect(() => {
      const newData = this.data();
      // Usamos untracked si no queremos que applyFilters cree dependencias circulares,
      // aunque aquí está bien.
      this.originalData.set([...newData]);
      this.applyFilters();
    });

    // Effect para configurar filtros
    effect(() => {
      const cols = this.columns();
      this.setupColumnFilters(cols);
    });

    // Effect para sort
    effect(() => {
      const sortField = this.defaultSortField();
      const sortOrder = this.defaultSortOrder();
      const tableRef = this.dt();

      if (sortField && tableRef) {
        // setTimeout a veces es necesario para PrimeNG al inicio,
        // pero intenta evitarlo si puedes. En zoneless a veces requestAnimationFrame es mejor.
        setTimeout(() => {
          tableRef.sortField = sortField;
          tableRef.sortOrder = sortOrder;
          tableRef.sortSingle();
        });
      }
    });
  }

  // ... El resto de tus métodos privados y públicos se mantienen igual ...

  private setupColumnFilters(cols: Column[]) {
    // ... tu código ...
    const filterControls: any = {};
    const filterVisibility: { [key: string]: boolean } = {};

    cols.forEach((col) => {
      if (col.filter) {
        filterControls[col.field] = [''];
        filterVisibility[col.field] = false;
      }
    });

    this.columnFiltersForm = this.fb.group(filterControls);
    this.showFilterInput.set(filterVisibility);

    Object.keys(this.columnFiltersForm.controls).forEach((field) => {
      this.columnFiltersForm.get(field)?.valueChanges.subscribe(() => {
        this.first.set(0);
        this.applyFilters();
      });
    });
  }

  private applyFilters() {
    // ... tu código ...
    const original = this.originalData();
    let filtered = [...original];

    this.columns().forEach((col) => {
      if (col.filter && this.columnFiltersForm.get(col.field)?.value) {
        const searchTerm = this.columnFiltersForm
          .get(col.field)
          ?.value.toLowerCase();
        filtered = filtered.filter((item) =>
          String(item[col.field]).toLowerCase().includes(searchTerm),
        );
      }
    });

    this.filteredData.set(filtered);
    this.totalRecords.set(filtered.length);
    this.updateDisplayedData();
  }

  private updateDisplayedData() {
    const filtered = this.filteredData();
    const firstIndex = this.first();
    const rows = this.rowsPerPage();
    const displayed = filtered.slice(firstIndex, firstIndex + rows);
    this.displayedData.set(displayed);
  }

  // ... Resto de métodos (clearFilter, toggleFilter, onPageChange, etc) ...
  // Asegúrate de copiarlos tal cual los tenías
  clearFilter(field: string) {
    if (this.columnFiltersForm.get(field)) {
      this.columnFiltersForm.get(field)?.setValue('');
    }
    const visibility = this.showFilterInput();
    this.showFilterInput.set({ ...visibility, [field]: false });
  }

  toggleFilter(field: string) {
    const visibility = this.showFilterInput();
    this.showFilterInput.set({ ...visibility, [field]: !visibility[field] });
  }

  onPageChange(event: any) {
    this.first.set(event.first);
    // ✨ FIX: Actualizar displayedData considerando el nuevo rows del evento
    const filtered = this.filteredData();
    const displayed = filtered.slice(event.first, event.first + event.rows);
    this.displayedData.set(displayed);
  }

  refreshData() {
    this.refresh.emit();
  }

  getRowActionLabel(action: RowAction, rowData: any): string {
    return typeof action.label === 'function'
      ? action.label(rowData)
      : action.label;
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

  isHeaderActionDisabled(action: TableAction): boolean {
    return action.isDisabled ? action.isDisabled() : false;
  }

  isHeaderActionVisible(action: TableAction): boolean {
    return action.isVisible ? action.isVisible() : true;
  }

  isRowActionDisabled(action: RowAction, rowData: any): boolean {
    return action.isDisabled ? action.isDisabled(rowData) : false;
  }

  isRowActionVisible(action: RowAction, rowData: any): boolean {
    return action.isVisible ? action.isVisible(rowData) : true;
  }

  truncate(value: any, limit: number = 30): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.length > limit ? str.slice(0, limit) + '…' : str;
  }
}
