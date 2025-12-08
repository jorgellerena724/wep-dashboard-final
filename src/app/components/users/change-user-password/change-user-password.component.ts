import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { UserService } from '../../../shared/services/users/user.service';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { passwordValidator } from '../../../core/validators/password.validator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-change-user-password',
  templateUrl: './change-user-password.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule
],
})
export class ChangeUserPasswordComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();

  form: FormGroup;
  @Output() submitSuccess = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private userSrv: UserService,
    private notificationSrv: NotificationService
  ) {
    this.form = this.fb.group(
      {
        id: [''],
        email: [''],
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(96),
            passwordValidator(),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    if (this.initialData?.email) {
      this.form.patchValue({
        id: this.initialData.id,
        email: this.initialData.email,
      });
    }
    this.formValid.emit(this.form.valid);
  }

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password === confirmPassword) {
      form.get('confirmPassword')?.setErrors(null);
      return null;
    }

    form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.transloco.selectTranslate('notifications.users.error.formInvalid').subscribe(message => {
        this.notificationSrv.addNotification(message, 'warning');
      });
      this.form.markAllAsTouched();
      return;
    }

    const formData = {
      id: this.form.get('id')?.value,
      newPassword: this.form.get('newPassword')?.value,
    };

    this.userSrv.changePassword(formData).subscribe({
      next: (response) => {
        this.transloco.selectTranslate('notifications.users.success.passwordChanged').subscribe(message => {
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
        this.transloco.selectTranslate('notifications.users.error.changePassword').subscribe(message => {
          this.notificationSrv.addNotification(message, 'error');
        });
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid;
  }
}
