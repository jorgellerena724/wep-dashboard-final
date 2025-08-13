import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectComponent } from '../../../shared/components/app-select/app-select.component';
import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { UserService } from '../../../shared/services/users/user.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-update-user',
  templateUrl: './update-user.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TextFieldComponent,
    TranslocoModule,
  ],
})
export class UpdateUserComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  form: FormGroup;
  @Output() submitSuccess = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private srv: UserService,
    private notificationSrv: NotificationService
  ) {
    this.form = this.fb.group({
      id: [''],
      full_name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
    });

    // Emitir el estado del formulario al modal padre
    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    if (this.initialData) {
      this.form.patchValue(this.initialData);
    }

    if (this.initialData) {
      // Primero hacemos una copia del initialData para no modificar el original
      const formData = { ...this.initialData };

      // Actualizar el formulario con los datos transformados
      this.form.patchValue(formData);
    }
    this.formValid.emit(this.form.valid);
  }

  onSubmit(): void {
    // Validar el formulario
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        'Compruebe los campos del formulario."Check the form fields."',
        'warning'
      );
      this.markAllFieldsAsTouched(); // Marcar todos los campos como tocados
      return;
    }

    // Procesar el formulario
    const formData = { ...this.form.value };
    formData.id = this.initialData.id;

    this.srv.patch(formData).subscribe({
      next: (response) => {
        this.notificationSrv.addNotification(
          'Usuario modificado satisfactoriamente.',
          'success'
        );
        this.submitSuccess.emit();
        this.form.reset();
        if (
          this.initialData?.onSave &&
          typeof this.initialData.onSave === 'function'
        ) {
          this.initialData.onSave();
        }
        if (!this.initialData?.closeOnSubmit) {
          this.form.reset();
        }
      },
      error: (error) => {
        if (error.error.message.includes('correo electrónico')) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          this.notificationSrv.addNotification(
            'Error al crear el usuario.',
            'error'
          );
        }
      },
    });
  }

  markAllFieldsAsTouched(): void {
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid;
  }
}
