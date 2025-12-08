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
import { ContactService } from '../../../shared/services/features/contact.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-update-contact',
  templateUrl: './update-contact.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule
],
})
export class UpdateContactComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private srv: ContactService,
    private notificationSrv: NotificationService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      address: ['', [Validators.minLength(3)]],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.initialData) {
      this.form.patchValue(this.initialData);

      this.id = this.initialData.id;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.transloco.selectTranslate('notifications.contact.error.formInvalid').subscribe(message => {
        this.notificationSrv.addNotification(message, 'warning');
      });
      this.form.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('email', this.form.get('email')?.value);
    formData.append('phone', this.form.get('phone')?.value);
    formData.append('address', this.form.get('address')?.value);

    this.srv.patch(formData, this.id).subscribe({
      next: (response) => {
        this.transloco.selectTranslate('notifications.contact.success.updated').subscribe(message => {
          this.notificationSrv.addNotification(message, 'success');
        });
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }

        if (!this.initialData?.closeOnSubmit) {
          this.form.reset();
        }
      },
      error: (error) => {
        this.transloco.selectTranslate('notifications.contact.error.update').subscribe(message => {
          this.notificationSrv.addNotification(message, 'error');
        });
        console.error('Error:', error);
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid;
  }
}
