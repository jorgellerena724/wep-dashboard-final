import { CommonModule } from '@angular/common';
import {
  Component,
  input,
  output,
  viewChild,
  forwardRef,
  signal,
  computed,
  effect,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ThemeService } from '../../../core/services/theme.service';

interface SelectOption {
  label: string;
  value: any;
  custom?: boolean;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FloatLabelModule],
  templateUrl: './app-select.component.html',
  styleUrl: './app-select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  // Inputs usando signal inputs
  options = input<SelectOption[]>([]);
  multiple = input<boolean>(false);
  validCombinations = input<string[][] | undefined>(undefined);
  placeholder = input<string>('Select...');
  label = input<string | undefined>(undefined);
  isLoading = input<boolean>(false);
  isAllDataLoaded = input<boolean>(false);
  allowCustomEntries = input<boolean>(false);
  formGroup = input<FormGroup | undefined>(undefined);
  isSearchable = input<boolean>(false);
  itemsPerPage = input<number>(10);
  control = input<FormControl | undefined>(undefined);
  usePagination = input<boolean>(false);
  disabled = input<boolean>(false);
  errorMessages = input<{ [key: string]: string }>({
    required: 'Este campo es requerido',
  });
  preserveSearchOnLoad = input<boolean>(false);

  // Outputs
  selectionChange = output<any>();
  search = output<string>();

  // ViewChild
  filterInput = viewChild<ElementRef>('filterInput');

  // Signals internos
  private _value = signal<any>(null);
  isOpen = signal<boolean>(false);
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  private searchTermChanged = signal<boolean>(false);

  // Computed signals
  value = computed(() => this._value());

  actualControl = computed(() => {
    const ctrl = this.control();
    if (ctrl) return ctrl;

    const fg = this.formGroup();
    const lbl = this.label();
    if (fg && lbl) {
      return fg.get(lbl) as FormControl;
    }
    return undefined;
  });

  shouldShowError = computed(() => {
    const ctrl = this.actualControl();
    return ctrl?.invalid && (ctrl?.dirty || ctrl?.touched);
  });

  displayValue = computed(() => {
    const val = this._value();
    const opts = this.options();
    const isMultiple = this.multiple();
    const ph = this.placeholder();

    if (!val || (Array.isArray(val) && val.length === 0)) {
      return ph;
    }

    if (isMultiple) {
      const values = Array.isArray(val) ? val : [];
      const selectedLabels = opts
        .filter((option) => values.includes(option.value))
        .map((option) => option.label);

      if (selectedLabels.length === 0) {
        return values.toString();
      }
      return selectedLabels.join(', ');
    }

    const selectedOption = opts.find((opt) => opt.value === val);
    return selectedOption ? selectedOption.label : val;
  });

  getErrorMessages = computed(() => {
    const ctrl = this.actualControl();
    if (!ctrl?.errors) return [];

    const customErrors = this.errorMessages();
    const defaultMessages: { [key: string]: string } = {
      required: 'Este campo es requerido',
      email: 'Email inválido',
      minlength: `Mínimo ${ctrl.errors?.['minlength']?.requiredLength} caracteres`,
      maxlength: `Máximo ${ctrl.errors?.['maxlength']?.requiredLength} caracteres`,
      pattern: 'Formato inválido',
      warning: 'Este campo es necesario para que tenga código del sistema',
    };

    return Object.keys(ctrl.errors).map((errorKey) => {
      return (
        customErrors[errorKey] || defaultMessages[errorKey] || 'Campo inválido'
      );
    });
  });

  filteredOptions = computed(() => {
    const opts = this.options();
    const term = this.searchTerm();

    if (!term) return opts;

    const normalizedSearchTerm = this.normalizeText(term);
    return opts.filter((option) =>
      this.normalizeText(option.label).includes(normalizedSearchTerm)
    );
  });

  paginatedOptions = computed(() => {
    let filtered = this.filteredOptions();
    const term = this.searchTerm();
    const allowCustom = this.allowCustomEntries();

    // Añadir opción custom si se permite y hay término de búsqueda
    if (allowCustom && term && !filtered.some((o) => o.value === term)) {
      filtered = [
        {
          label: `${term} (nuevo)`,
          value: term,
          custom: true,
        },
        ...filtered,
      ];
    }

    if (!this.usePagination()) {
      return filtered;
    }

    const page = this.currentPage();
    const perPage = this.itemsPerPage();
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filtered.slice(startIndex, endIndex);
  });

  regularOptions = computed(() => {
    return this.paginatedOptions().filter((option) => !option.custom);
  });

  totalPages = computed(() => {
    if (!this.usePagination()) {
      return 1;
    }

    const filtered = this.filteredOptions();
    const perPage = this.itemsPerPage();
    return Math.ceil(filtered.length / perPage);
  });

  hasSelectedValues = computed(() => {
    const val = this._value();
    if (this.multiple()) {
      return val && val.length > 0;
    }
    return !!val;
  });

  showCustomOption = computed(() => {
    const term = this.searchTerm();
    const opts = this.options();
    return (
      this.allowCustomEntries() &&
      term !== '' &&
      !opts.some((o) => o.value === term)
    );
  });

  // Callbacks para ControlValueAccessor
  private onChange = (_: any) => {};
  private onTouched = () => {};

  constructor(
    private elementRef: ElementRef,
    private themeService: ThemeService
  ) {
    // Effect para inicializar valor
    effect(() => {
      const isMultiple = this.multiple();
      if (this._value() === null || this._value() === undefined) {
        this._value.set(isMultiple ? [] : null);
      }
    });

    // Effect para resetear paginación cuando cambian las opciones
    effect(() => {
      this.options(); // Track options changes
      this.currentPage.set(1);

      // Solo resetear searchTerm si no queremos preservarlo o si no se ha modificado aún
      if (!this.preserveSearchOnLoad() || !this.searchTermChanged()) {
        this.searchTerm.set('');
      }
    });
  }

  normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.isSearchable()) {
      event.preventDefault();
      const filtered = this.filteredOptions();
      if (filtered.length > 0) {
        this.selectOption(filtered[0]);
      }
    }
  }

  isOptionDisabled(option: SelectOption): boolean {
    const validCombos = this.validCombinations();
    if (!validCombos || !this.multiple()) {
      return false;
    }

    const currentSelection = Array.isArray(this._value()) ? this._value() : [];

    if (currentSelection.length === 0) {
      return false;
    }

    if (currentSelection.includes(option.value)) {
      return false;
    }

    const hypotheticalSelection = [...currentSelection, option.value];

    return !validCombos.some((combination) => {
      const allSelected = hypotheticalSelection.every((selected) =>
        combination.includes(selected)
      );
      const withinLimit = hypotheticalSelection.length <= combination.length;
      return allSelected && withinLimit;
    });
  }

  isSelected(option: SelectOption): boolean {
    const val = this._value();
    if (this.multiple()) {
      return Array.isArray(val) && val.includes(option.value);
    }
    return val === option.value;
  }

  nextPage() {
    const total = this.totalPages();
    const current = this.currentPage();
    if (current < total) {
      this.currentPage.set(current + 1);
    }
  }

  previousPage() {
    const current = this.currentPage();
    if (current > 1) {
      this.currentPage.set(current - 1);
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.isOpen.set(false);
    }
  }

  onCustomOptionClick() {
    const term = this.searchTerm();
    const customOption: SelectOption = {
      label: term,
      value: term,
    };

    this._value.set(customOption.value);
    this.onChange(customOption.value);
    this.selectionChange.emit(customOption.value);
    this.isOpen.set(false);
    this.searchTerm.set('');
  }

  onInputChange(event: Event) {
    const previousSearch = this.searchTerm();
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    this.searchTermChanged.set(true);

    if (previousSearch !== this.searchTerm()) {
      this.search.emit(this.searchTerm());

      // Si permitimos entradas personalizadas, actualizar el valor
      if (this.allowCustomEntries() && this.searchTerm()) {
        this._value.set(this.searchTerm());
        this.onChange(this.searchTerm());
        this.selectionChange.emit(this.searchTerm());
      }
    }

    this.currentPage.set(1);
  }

  onOptionClick(option: SelectOption) {
    if (this.disabled()) return;

    // Si es una opción custom
    if (this.allowCustomEntries() && option.value === this.searchTerm()) {
      const customOption: SelectOption = {
        label: this.searchTerm(),
        value: this.searchTerm(),
      };

      this._value.set(customOption.value);
      this.onChange(customOption.value);
      this.selectionChange.emit(customOption.value);
      this.isOpen.set(false);
      this.searchTerm.set('');
      return;
    }

    // Lógica normal de selección
    if (this.multiple()) {
      this.toggleOption(option);
    } else {
      this.selectOption(option);
    }
  }

  selectOption(option: SelectOption) {
    if (this.multiple()) {
      this.toggleOption(option);
      return;
    }
    this._value.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.selectionChange.emit(option.value);
    this.isOpen.set(false);
  }

  toggleOption(option: SelectOption) {
    if (this.isOptionDisabled(option)) return;
    if (!this.multiple()) return;

    let currentValue = this._value();
    if (!Array.isArray(currentValue)) {
      currentValue = [];
    }

    const index = currentValue.indexOf(option.value);
    let newValue: any[];

    if (index === -1) {
      newValue = [...currentValue, option.value];
    } else {
      newValue = currentValue.filter((v: any) => v !== option.value);
    }

    this._value.set(newValue);
    this.onChange(newValue);
    this.onTouched();
    this.selectionChange.emit(newValue);
  }

  toggleDropdown() {
    if (this.disabled()) return;

    this.isOpen.update((v) => !v);

    if (this.isOpen() && this.isSearchable()) {
      setTimeout(() => {
        this.filterInput()?.nativeElement?.focus();
      });
    }
    this.onTouched();
  }

  trackByFn(index: number, option: SelectOption): any {
    return option.value;
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      this._value.set(this.multiple() ? [] : null);
    } else {
      this._value.set(value);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}
