import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  OnInit,
  HostListener,
  ElementRef,
  ViewChild,
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
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor, OnInit {
  @Input() options: SelectOption[] = [];
  @Input() multiple: boolean = false;
  @Input() validCombinations?: string[][] = undefined;
  @Input() placeholder: string = 'Select...';
  @Input() label?: string;
  @Input() isLoading: boolean = false;
  @Input() isAllDataLoaded: boolean = false;
  @Input() allowCustomEntries: boolean = false;
  @Input() value: any;
  @Input() formGroup!: FormGroup;
  @Input() isSearchable: boolean = false;
  @Input() itemsPerPage: number = 10;
  @Output() selectionChange = new EventEmitter<any>();
  @Output() search = new EventEmitter<string>();
  @Input() control: any;
  @Input() usePagination: boolean = false;
  @Input() disabled = false;
  @Input() errorMessages: { [key: string]: string } = {
    required: 'Este campo es requerido',
  };
  @Input() preserveSearchOnLoad: boolean = false;
  @ViewChild('filterInput') filterInput!: ElementRef;
  private searchTermChanged: boolean = false;
  isOpen = false;
  searchTerm: string = '';
  currentPage: number = 1;
  onChange = (_: any) => {};
  onTouched = () => {};

  constructor(
    private elementRef: ElementRef,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.value = this.multiple ? [] : null;
    // Si el control no está definido pero estamos en un FormGroup
    if (!this.control && this.formGroup && this.label) {
      this.control = this.formGroup.get(this.label) as FormControl;
    }
  }

  ngOnChanges() {
    // Resetear paginación cuando las opciones cambian
    this.currentPage = 1;

    // Solo resetear searchTerm si no queremos preservarlo o si no se ha modificado aún
    if (!this.preserveSearchOnLoad || !this.searchTermChanged) {
      this.searchTerm = '';
    }
  }

  get shouldShowError(): boolean {
    return (
      this.control?.invalid && (this.control?.dirty || this.control?.touched)
    );
  }

  normalizeText(text: string): string {
    return text
      .normalize('NFD') // Descompone los caracteres con acentos en su forma base
      .replace(/[\u0300-\u036f]/g, '') // Elimina los caracteres diacríticos
      .toLowerCase(); // Convierte todo a minúsculas para asegurar la insensibilidad a mayúsculas/minúsculas
  }

  getDisplayValue(): string {
    if (!this.value || (Array.isArray(this.value) && this.value.length === 0)) {
      return this.placeholder;
    }

    if (this.multiple) {
      if (!Array.isArray(this.value)) {
        this.value = [];
      }
      const selectedLabels = this.options
        .filter((option) => this.value.includes(option.value))
        .map((option) => option.label);

      // Si alguna opción no se encuentra, se puede agregar el valor custom
      if (selectedLabels.length === 0) {
        return this.value.toString();
      }
      return selectedLabels.join(', ');
    }

    const selectedOption = this.options.find((opt) => opt.value === this.value);
    return selectedOption ? selectedOption.label : this.value;
  }

  getErrorMessages(): string[] {
    if (!this.control?.errors) return [];
    const defaultMessages: { [key: string]: string } = {
      required: 'Este campo es requerido',
      email: 'Email inválido',
      minlength: `Mínimo ${this.control.errors?.['minlength']?.requiredLength} caracteres`,
      maxlength: `Máximo ${this.control.errors?.['maxlength']?.requiredLength} caracteres`,
      pattern: 'Formato inválido',
      warning: 'Este campo es necesario para que tenga código del sistema',
    };
    return Object.keys(this.control.errors).map((errorKey) => {
      return (
        this.errorMessages[errorKey] ||
        defaultMessages[errorKey] ||
        'Campo inválido'
      );
    });
  }

  getFilteredOptions(): SelectOption[] {
    if (!this.searchTerm) return this.options;

    const normalizedSearchTerm = this.normalizeText(this.searchTerm);

    return this.options.filter((option) =>
      this.normalizeText(option.label).includes(normalizedSearchTerm)
    );
  }

  getPaginatedOptions(): SelectOption[] {
    let filteredOptions = this.getFilteredOptions();

    // Añadir opción custom si se permite y hay término de búsqueda
    if (
      this.allowCustomEntries &&
      this.searchTerm &&
      !filteredOptions.some((o) => o.value === this.searchTerm)
    ) {
      filteredOptions = [
        {
          label: `${this.searchTerm} (nuevo)`,
          value: this.searchTerm,
          custom: true, // <-- la marcamos
        },
        ...filteredOptions,
      ];
    }

    if (!this.usePagination) {
      return filteredOptions;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return filteredOptions.slice(startIndex, endIndex);
  }

  getRegularOptions(): SelectOption[] {
    // Se muestran todas las paginadas, salvo las que sean custom
    return this.getPaginatedOptions().filter((option) => !option.custom);
  }

  getTotalPages(): number {
    if (!this.usePagination) {
      return 1; // Solo una página si la paginación está deshabilitada
    }

    const filteredOptions = this.getFilteredOptions();
    return Math.ceil(filteredOptions.length / this.itemsPerPage);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.isSearchable) {
      event.preventDefault();
      const filteredOptions = this.getFilteredOptions();
      if (filteredOptions.length > 0) {
        this.selectOption(filteredOptions[0]);
      }
    }
  }

  hasSelectedValues(): boolean {
    if (this.multiple) {
      return this.value && this.value.length > 0;
    } else {
      return !!this.value;
    }
  }

  isOptionDisabled(option: SelectOption): boolean {
    if (!this.validCombinations || !this.multiple) {
      return false;
    }

    const currentSelection = Array.isArray(this.value) ? this.value : [];

    if (currentSelection.length === 0) {
      return false;
    }

    if (currentSelection.includes(option.value)) {
      return false;
    }

    const hypotheticalSelection = [...currentSelection, option.value];

    return !this.validCombinations.some((combination) => {
      const allSelected = hypotheticalSelection.every((selected) =>
        combination.includes(selected)
      );

      const withinLimit = hypotheticalSelection.length <= combination.length;

      return allSelected && withinLimit;
    });
  }

  isSelected(option: SelectOption): boolean {
    if (this.multiple) {
      return Array.isArray(this.value) && this.value.includes(option.value);
    }
    return this.value === option.value;
  }

  nextPage() {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.isOpen = false;
    }
  }

  onCustomOptionClick() {
    const customOption: SelectOption = {
      label: this.searchTerm,
      value: this.searchTerm,
    };

    this.value = customOption.value;
    this.onChange(this.value);
    this.selectionChange.emit(this.value);
    this.isOpen = false;
    this.searchTerm = '';
  }

  onInputChange(event: Event) {
    const previousSearch = this.searchTerm;
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.searchTermChanged = true;

    if (previousSearch !== this.searchTerm) {
      this.search.emit(this.searchTerm);
      // Si permitimos entradas personalizadas, actualizar el valor
      if (this.allowCustomEntries && this.searchTerm) {
        this.value = this.searchTerm;
        this.onChange(this.value);
        this.selectionChange.emit(this.value);
      }
    }

    this.currentPage = 1;
  }

  onOptionClick(option: SelectOption) {
    if (this.disabled) return;

    // Si es una opción custom
    if (this.allowCustomEntries && option.value === this.searchTerm) {
      // Emitir el objeto completo de la opción en lugar del string
      const customOption: SelectOption = {
        label: this.searchTerm,
        value: this.searchTerm,
      };

      this.value = customOption.value;
      this.onChange(this.value);
      this.selectionChange.emit(this.value);
      this.isOpen = false;

      // Limpiar el searchTerm después de seleccionar
      this.searchTerm = '';
      return;
    }

    // Lógica normal de selección
    if (this.multiple) {
      this.toggleOption(option);
    } else {
      this.selectOption(option);
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  selectOption(option: SelectOption) {
    if (this.multiple) {
      this.toggleOption(option);
      return;
    }
    this.value = option.value;
    this.onChange(this.value);
    this.onTouched(); // Agregar esta línea
    this.selectionChange.emit(this.value);
    this.isOpen = false;
  }

  showCustomOption(): boolean {
    return (
      this.allowCustomEntries &&
      this.searchTerm !== '' &&
      !this.options.some((o) => o.value === this.searchTerm)
    );
  }

  toggleOption(option: SelectOption) {
    if (this.isOptionDisabled(option)) return;

    if (!this.multiple) return;

    if (!Array.isArray(this.value)) {
      this.value = [];
    }

    const index = this.value.indexOf(option.value);
    if (index === -1) {
      this.value = [...this.value, option.value];
    } else {
      this.value = this.value.filter((v: any) => v !== option.value);
    }

    this.onChange(this.value);
    this.onTouched(); // Agregar esta línea
    this.selectionChange.emit(this.value);
  }

  toggleDropdown() {
    if (this.disabled) return;

    this.isOpen = !this.isOpen;
    if (this.isOpen && this.isSearchable) {
      setTimeout(() => {
        this.filterInput?.nativeElement.focus();
      });
    }
    this.onTouched();
  }

  trackByFn(index: number, option: SelectOption): any {
    return option.value;
  }

  writeValue(value: any): void {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      this.value = this.multiple ? [] : null;
    } else {
      this.value = value;
    }
    this.onChange(this.value);
  }
}
