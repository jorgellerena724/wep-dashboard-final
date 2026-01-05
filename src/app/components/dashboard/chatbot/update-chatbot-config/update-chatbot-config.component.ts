import {
  Component,
  inject,
  output,
  signal,
  effect,
  computed,
  ChangeDetectionStrategy,
  input,
  untracked,
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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { ChatbotService } from '../../../../shared/services/features/chatbot.service';
import { UserService } from '../../../../shared/services/users/user.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-update-chatbot-config',
  templateUrl: './update-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    SelectComponent,
  ],
})
export class UpdateChatbotConfigComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private chatbotConfigSrv = inject(ChatbotService);
  private userSrv = inject(UserService);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals
  models = signal<any[]>([]);
  users = signal<any[]>([]);
  uploading = signal(false);
  isFormValid = signal(false);
  configId = signal<number | null>(null);

  // Computed
  isSubmitting = signal<boolean>(false);
  isFormInvalid = computed(() => !this.isFormValid() || this.uploading());

  // Form - API_KEY NO es requerido en update (solo en create)
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      user_id: ['', [Validators.required]],
      api_key: ['', [Validators.minLength(20)]], // Solo validación de longitud si se envía
      model_id: ['', [Validators.required]],
      prompt: ['', [Validators.required, Validators.minLength(10)]],
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          // Mapear datos correctamente
          const formData = {
            user_id: data.user_id || data.user?.id, // Tomar user_id directo o del objeto user
            model_id: data.model_id || data.model?.id, // Tomar model_id directo o del objeto model
            prompt: data.prompt || '',
            api_key: '', // No establecer api_key porque no se envía por seguridad
          };

          this.form.patchValue(formData);
          this.configId.set(data.id); // Guardar el ID para el update
        });
      }
    });

    effect(() => {
      this.fetchModels();
      this.fetchUsers();
    });

    // Effect para emitir validez del formulario
    effect(() => {
      const isValid = this.isFormValid();
      this.formValid.emit(isValid);
    });

    // Suscripción al estado del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.isFormValid.set(this.form.valid);
      });

    // Re-validar cuando cambie el usuario
    this.form.get('user_id')?.valueChanges.subscribe(() => {
      this.form.get('api_key')?.updateValueAndValidity();
    });
  }

  fetchUsers(): void {
    this.userSrv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.users.set(
            data.map((user: any) => ({
              value: user.id,
              label: `${user.full_name} (${user.email})`,
            }))
          );
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.users.error.load'),
            'error'
          );
        },
      });
  }

  fetchModels(): void {
    this.chatbotConfigSrv
      .getModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.models.set(
            data.map((model: any) => ({
              value: model.id,
              label: model.name,
            }))
          );
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.chatbot_config.error.loadModels'
            ),
            'error'
          );
        },
      });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.chatbot_config.error.formInvalid'
        ),
        'warning'
      );
      this.form.markAllAsTouched();

      this.submitError.emit();
      return;
    }

    this.uploading.set(true);

    // Construir payload - API_KEY solo si tiene valor
    const formValue = this.form.value;
    const payload: any = {
      user_id: formValue.user_id,
      model_id: formValue.model_id,
      prompt: formValue.prompt.trim(),
    };

    // Solo incluir api_key si no está vacío
    if (formValue.api_key && formValue.api_key.trim() !== '') {
      payload.api_key = formValue.api_key.trim();
    }

    const configId = this.configId();
    if (!configId) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.chatbot_config.error.invalidId'
        ),
        'error'
      );
      this.uploading.set(false);
      this.submitError.emit();
      return;
    }

    // Usar PATCH para actualizar
    this.chatbotConfigSrv
      .patch(payload, configId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);

          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.chatbot_config.success.updated'
            ),
            'success'
          );

          this.submitSuccess.emit();

          const data = this.initialData();
          if (data?.onSave) {
            data.onSave();
          }
        },
        error: (error) => {
          this.uploading.set(false);

          let errorMessage = this.transloco.translate(
            'notifications.chatbot_config.error.update'
          );

          // Manejar errores específicos
          if (error.status === 400) {
            if (
              error.error?.detail?.includes('already exists') ||
              error.error?.detail?.includes('Ya existe')
            ) {
              errorMessage = this.transloco.translate(
                'notifications.chatbot_config.error.userExists'
              );
            } else if (error.error?.detail?.includes('invalid API key')) {
              errorMessage = this.transloco.translate(
                'notifications.chatbot_config.error.invalidApiKey'
              );
            }
          } else if (error.status === 409) {
            errorMessage = this.transloco.translate(
              'notifications.chatbot_config.error.userExists'
            );
          } else if (error.status === 404) {
            errorMessage = this.transloco.translate(
              'notifications.users.error.notFound'
            );
          }

          this.notificationSrv.addNotification(errorMessage, 'error');

          this.isSubmitting.set(false);
          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
