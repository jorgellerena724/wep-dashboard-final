import { CommonModule } from '@angular/common';
import {
  Component,
  input,
  forwardRef,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormGroup,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app-text-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextFieldComponent),
      multi: true,
    },
  ],
})
export class TextFieldComponent implements ControlValueAccessor {
  // Inputs usando signal inputs
  id = input<string>('');
  formatCard = input<boolean>(false);
  preventNegative = input<boolean>(false);
  label = input<string>('');
  type = input<string>('text');
  numbersOnly = input<boolean>(false);
  allowDecimals = input<boolean>(false);
  maxLength = input<number | undefined>(undefined);
  placeholder = input<string>('');
  errorMessages = input<{ [key: string]: string }>({});
  formGroup = input<FormGroup | undefined>(undefined);
  control = input<FormControl | undefined>(undefined);
  disabled = input<boolean>(false);
  errorMessage = input<string>('');
  isTextArea = input<boolean>(false);
  textAreaHeight = input<string>('h-28');

  // ViewChild para acceder a los elementos del DOM
  inputElement = viewChild<ElementRef<HTMLInputElement>>('input');
  textareaElement = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  // Signals internos
  private _value = signal<any>('');
  private _disabledState = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  hadError = signal<boolean>(false);
  private errorTracker = signal<number>(0);

  // ✅ Signal para trackear si ya nos suscribimos
  private subscribed = signal<boolean>(false);

  // Computed para combinar disabled input y estado interno
  isDisabled = computed(() => this.disabled() || this._disabledState());

  // Computed signals
  value = computed(() => this._value());

  // Computed para obtener el control correcto del FormGroup o directamente
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
    // Forzar recalculo cuando cambie errorTracker
    this.errorTracker();

    const ctrl = this.actualControl();
    return ctrl?.invalid && (ctrl?.dirty || ctrl?.touched);
  });

  wasFixedError = computed(() => {
    this.errorTracker();

    const ctrl = this.actualControl();
    return this.hadError() && ctrl?.valid && ctrl?.touched;
  });

  getErrorMessages = computed(() => {
    this.errorTracker();

    const customError = this.errorMessage();
    if (customError) {
      return [customError];
    }

    const ctrl = this.actualControl();
    if (!ctrl?.errors) return [];

    const customErrors = this.errorMessages();
    const defaultMessages: { [key: string]: string } = {
      required: 'Este campo es requerido',
      email: 'Email inválido',
      minlength: `Mínimo ${ctrl.errors?.['minlength']?.requiredLength} caracteres`,
      maxlength: `Máximo ${ctrl.errors?.['maxlength']?.requiredLength} caracteres`,
      pattern: 'Formato inválido',
      passwordMismatch: 'Las contraseñas no coinciden',
      warning: 'Este campo es necesario para que tenga código del sistema',
    };

    return Object.keys(ctrl.errors).map((errorKey) => {
      return (
        customErrors[errorKey] || defaultMessages[errorKey] || 'Campo inválido'
      );
    });
  });

  effectiveType = computed(() => {
    if (this.isTextArea()) return 'text';
    if (this.type() === 'password' && this.showPassword()) return 'text';
    return this.type();
  });

  // Callbacks para ControlValueAccessor
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Effect para sincronizar el estado disabled
    effect(() => {
      const ctrl = this.actualControl();
      const shouldDisable = this.isDisabled();

      if (ctrl && shouldDisable) {
        Promise.resolve().then(() => {
          ctrl.disable();
        });
      }
    });

    // ✅ Effect mejorado para manejar suscripciones sin duplicados
    effect(() => {
      const ctrl = this.actualControl();

      // Si no hay control o ya nos suscribimos, salir
      if (!ctrl) {
        this.subscribed.set(false);
        return;
      }

      // Si ya nos suscribimos a este control, no hacerlo de nuevo
      if (this.subscribed()) return;

      // Verificar estado inicial
      if (ctrl.invalid && ctrl.touched) {
        this.hadError.set(true);
      }

      // ✅ Suscribirse a cambios de estado UNA SOLA VEZ
      ctrl.statusChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Actualizar el tracker para forzar recalculo de computed signals
          this.errorTracker.update((v) => v + 1);

          // Actualizar hadError cuando el campo tiene errores y fue tocado
          if (ctrl.invalid && ctrl.touched) {
            this.hadError.set(true);
          }
        });

      // ✅ Suscribirse también a valueChanges para detectar cuando se marca como touched
      ctrl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.errorTracker.update((v) => v + 1);
        });

      // Marcar como suscrito
      this.subscribed.set(true);
    });
  }

  numberValidation(event: KeyboardEvent) {
    const allowedKeys = [
      'Backspace',
      'Tab',
      'End',
      'Home',
      'ArrowLeft',
      'ArrowRight',
      'Delete',
      '.',
    ];

    // Permitir punto y coma si allowDecimals está activado
    if (this.allowDecimals()) {
      allowedKeys.push('.');
    }

    const isDecimal = event.key === '.' || event.key === ',';
    const isNumber = !isNaN(Number(event.key));

    // Verificar si es una tecla permitida
    if (allowedKeys.includes(event.key)) {
      // Manejar separadores decimales
      if (isDecimal) {
        const input = event.target as HTMLInputElement;
        const currentValue = input.value;

        // Verificar si ya existe un separador decimal
        const hasDecimalSeparator =
          currentValue.includes('.') || currentValue.includes(',');

        if (hasDecimalSeparator) {
          event.preventDefault();
        }
      }
      return;
    }

    // Permitir números
    if (isNumber) {
      return;
    }

    // Permitir punto decimal en teclado numérico
    if (event.key === 'Decimal') {
      const input = event.target as HTMLInputElement;
      const currentValue = input.value;

      if (!currentValue.includes('.') && !currentValue.includes(',')) {
        return;
      }
      event.preventDefault();
      return;
    }

    // Bloquear cualquier otra tecla
    event.preventDefault();
  }

  onBlur(): void {
    this.onTouched();

    // Actualizar errorTracker para forzar recalculo
    this.errorTracker.update((v) => v + 1);

    // Actualizar hadError si hay un error después de tocar el campo
    const ctrl = this.actualControl();
    if (ctrl?.invalid && ctrl?.touched) {
      this.hadError.set(true);
    }
  }

  onCardInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');

    // Limitar a 16 dígitos
    if (value.length > 16) {
      value = value.substring(0, 16);
    }

    // Formatear con guiones
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += '-';
      }
      formatted += value[i];
    }

    // Actualizar valor en el input y modelo
    input.value = formatted;
    this.onChange(formatted);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    let newValue = input.value;

    if (this.allowDecimals()) {
      // Reemplazar comas por puntos para consistencia interna
      newValue = newValue.replace(/,/g, '.');

      // Permitir solo un punto decimal
      const parts = newValue.split('.');
      if (parts.length > 2) {
        newValue = parts[0] + '.' + parts.slice(1).join('');
      }

      // Limitar decimales a 2 dígitos
      if (parts.length > 1 && parts[1].length > 2) {
        newValue = parts[0] + '.' + parts[1].substring(0, 2);
      }
    }

    if (this.numbersOnly()) {
      newValue = newValue.replace(/[^0-9]/g, '');
    }

    const maxLen = this.maxLength();
    if (maxLen && newValue.length > maxLen) {
      newValue = newValue.substring(0, maxLen);
      input.value = newValue;

      const ctrl = this.actualControl();
      setTimeout(() => {
        ctrl?.updateValueAndValidity();
        this.errorTracker.update((v) => v + 1);
      });
    }

    if (this.formatCard()) {
      this.onCardInput(event);
    } else {
      this.onChange(newValue);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    let processedValue = value;

    if (this.numbersOnly() && value) {
      processedValue = value.toString().replace(/[^0-9]/g, '');
    }

    const maxLen = this.maxLength();
    if (maxLen && processedValue?.length > maxLen) {
      processedValue = processedValue.substring(0, maxLen);
    }

    if (this.allowDecimals() && value) {
      processedValue = String(value).replace(/,/g, '.');
    }

    if (this.formatCard() && processedValue) {
      const cleaned = processedValue.replace(/[^0-9]/g, '');
      let formatted = '';
      for (let i = 0; i < cleaned.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += cleaned[i];
      }
      this._value.set(formatted);
    } else {
      this._value.set(processedValue);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledState.set(isDisabled);
  }
}
