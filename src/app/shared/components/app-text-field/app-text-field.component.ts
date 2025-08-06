import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  forwardRef,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app-text-field.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextFieldComponent),
      multi: true,
    },
  ],
})
export class TextFieldComponent
  implements ControlValueAccessor, OnInit, AfterViewInit
{
  @Input() id: string = '';
  @Input() formatCard: boolean = false;
  @Input() preventNegative: boolean = false;
  @Input() label: string = '';
  @Input() type: string = 'text';
  @Input() numbersOnly: boolean = false;
  @Input() allowDecimals: boolean = false;
  @Input() maxLength: number | undefined; // Límite de caracteres
  @Input() placeholder: string = '';
  @Input() errorMessages: { [key: string]: string } = {};
  @Input() formGroup!: FormGroup;
  @Input() control: any;
  @Input() disabled = false;
  @Input() errorMessage: string = '';
  @Input() isTextArea: boolean = false; // Nueva propiedad para comportarse como textarea
  @Input() textAreaHeight: string = 'h-28'; // Altura por defecto del textarea

  value: any = '';
  showPassword: boolean = false;
  hadError: boolean = false; // Propiedad para rastrear si hubo un error previo
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Sincronizar el estado inicial
    if (this.control && this.disabled) {
      // Deferimos la actualización del control para evitar ExpressionChangedAfterItHasBeenCheckedError
      Promise.resolve().then(() => {
        this.control.disable();
      });
    }

    // Verificar si el control ya tiene errores al iniciar
    if (this.control?.invalid && this.control?.touched) {
      this.hadError = true;
    }

    // Si es un textarea, asegurarse de que el tipo sea texto
    if (this.isTextArea) {
      this.type = 'text';
    }
  }

  ngAfterViewInit(): void {
    // Aseguramos que los cambios están sincronizados
    this.cdr.detectChanges();
  }

  getErrorMessages(): string[] {
    if (this.errorMessage) {
      return [this.errorMessage];
    }

    if (!this.control?.errors) return [];
    const defaultMessages: { [key: string]: string } = {
      required: 'Este campo es requerido',
      email: 'Email inválido',
      minlength: `Mínimo ${this.control.errors?.['minlength']?.requiredLength} caracteres`,
      maxlength: `Máximo ${this.control.errors?.['maxlength']?.requiredLength} caracteres`,
      pattern: 'Formato inválido',
      passwordMismatch: 'Las contraseñas no coinciden',
    };
    return Object.keys(this.control.errors).map((errorKey) => {
      return (
        this.errorMessages[errorKey] ||
        defaultMessages[errorKey] ||
        'Campo inválido'
      );
    });
  }

  get shouldShowError(): boolean {
    return (
      this.control?.invalid && (this.control?.dirty || this.control?.touched)
    );
  }

  // Propiedad para controlar si debemos mostrar el borde verde
  get wasFixedError(): boolean {
    return this.hadError && this.control?.valid && this.control?.touched;
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
    ];

    // Permitir punto y coma si allowDecimals está activado
    if (this.allowDecimals) {
      allowedKeys.push('.', ',');
    }

    // Variables de tu lógica original
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

    // Actualizar hadError si hay un error después de tocar el campo
    if (this.control?.invalid && this.control?.touched) {
      this.hadError = true;
    }
  }

  onCardInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, ''); // Eliminar caracteres no numéricos

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

    if (this.allowDecimals) {
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

    if (this.numbersOnly) {
      newValue = newValue.replace(/[^0-9]/g, '');
    }

    if (this.maxLength && newValue.length > this.maxLength) {
      newValue = newValue.substring(0, this.maxLength);
      input.value = newValue; // Update the visible input

      // Important: Manually trigger change detection to update validation
      setTimeout(() => {
        this.control.updateValueAndValidity();
        this.cdr.detectChanges();
      });
    }

    if (this.formatCard) {
      this.onCardInput(event);
    } else {
      this.onChange(newValue);
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

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  writeValue(value: any): void {
    let processedValue = value;

    if (this.numbersOnly && value) {
      processedValue = value.toString().replace(/[^0-9]/g, '');
    }

    if (this.maxLength && processedValue?.length > this.maxLength) {
      processedValue = processedValue.substring(0, this.maxLength);
    }

    if (this.allowDecimals && value) {
      // Convertir a string y reemplazar comas por puntos
      processedValue = String(value).replace(/,/g, '.');
    }

    if (this.formatCard && processedValue) {
      const cleaned = processedValue.replace(/[^0-9]/g, '');
      let formatted = '';
      for (let i = 0; i < cleaned.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += cleaned[i];
      }
      this.value = formatted;
    } else {
      this.value = processedValue;
    }
  }
}
