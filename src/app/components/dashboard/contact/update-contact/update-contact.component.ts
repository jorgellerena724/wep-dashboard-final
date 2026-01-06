import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { ContactService } from '../../../../shared/services/features/contact.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-update-contact',
  templateUrl: './update-contact.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateContactComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ContactService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  // Computed para traducciones de error
  formInvalidMessage = computed(() =>
    this.transloco.translate('notifications.contact.error.formInvalid')
  );

  updatedMessage = computed(() =>
    this.transloco.translate('notifications.contact.success.updated')
  );

  updateErrorMessage = computed(() =>
    this.transloco.translate('notifications.contact.error.update')
  );

  constructor() {
    this.form = this.fb.group({
      email: [
        '',
        [Validators.required, Validators.email, Validators.minLength(3)],
      ],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      address: ['', [Validators.minLength(3)]],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);
        });
      }
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.formInvalidMessage(),
        'warning'
      );
      this.form.markAllAsTouched();
      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('email', this.form.get('email')?.value.trim());
    formData.append('phone', this.form.get('phone')?.value.trim());

    // Solo agregar dirección si tiene contenido
    const addressValue = this.form.get('address')?.value?.trim();
    if (addressValue) {
      formData.append('address', addressValue);
    }

    this.uploading.set(true);

    this.srv
      .patch(formData, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);

          this.notificationSrv.addNotification(
            this.updatedMessage(),
            'success'
          );
          this.submitSuccess.emit();

          const data = this.initialData();
          if (data?.onSave) {
            data.onSave();
          }

          if (!data?.closeOnSubmit) {
            this.form.reset();
          }
        },
        error: (error) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.updateErrorMessage(),
            'error'
          );
          console.error('Error:', error);
          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
