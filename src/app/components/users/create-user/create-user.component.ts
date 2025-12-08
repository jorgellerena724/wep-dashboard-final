import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { UserService } from '../../../shared/services/users/user.service';
import { passwordValidator } from '../../../core/validators/password.validator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule
],
})
export class CreateUserComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  form: FormGroup;
  showUebField = false;

  constructor(
    private fb: FormBuilder,
    private srv: UserService,
    private notificationSrv: NotificationService
  ) {
    this.form = this.fb.group({
      full_name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
        ],
      ],
      client: ['', Validators.required],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(50),
          passwordValidator(),
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
    this.formValid.emit(this.form.valid);
  }

  onSubmit(): void {
    // Validar el formulario
    if (this.form.invalid) {
      this.transloco.selectTranslate('notifications.users.error.formInvalid').subscribe(message => {
        this.notificationSrv.addNotification(message, 'warning');
      });
      this.markAllFieldsAsTouched();
      return;
    }

    // Procesar el formulario
    const formData = { ...this.form.value };

    this.srv.post(formData).subscribe({
      next: (response) => {
        this.transloco.selectTranslate('notifications.users.success.created').subscribe(message => {
          this.notificationSrv.addNotification(message, 'success');
        });
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
          this.transloco.selectTranslate('notifications.users.error.emailExists').subscribe(message => {
            this.notificationSrv.addNotification(message, 'error');
          });
        } else {
          this.transloco.selectTranslate('notifications.users.error.create').subscribe(message => {
            this.notificationSrv.addNotification(message, 'error');
          });
        }
      },
    });
  }

  markAllFieldsAsTouched(): void {
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      if (control) {
        control.markAsTouched();
        // Forzar validación en cada cambio
        control.updateValueAndValidity({ onlySelf: true, emitEvent: true });
      }
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid;
  }
}
