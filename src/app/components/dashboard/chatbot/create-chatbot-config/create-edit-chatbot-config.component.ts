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

@Component({
  selector: 'app-create-edit-chatbot-config',
  templateUrl: './create-edit-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    SelectComponent,
  ],
})
export class CreateEditChatbotConfigComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private chatbotConfigSrv = inject(ChatbotService);
  private userSrv = inject(UserService);
  private notificationSrv = inject(NotificationService);

  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals
  models = signal<any[]>([]);
  users = signal<any[]>([]);
  isFormValid = signal(false);
  configId = signal<number | null>(null); // Para edición
  isEditing = computed(() => this.configId() !== null);

  // Computed
  isSubmitting = signal<boolean>(false);
  isFormInvalid = computed(() => !this.isFormValid());

  // Form
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      user_id: ['', [Validators.required]],
      api_key: ['', [Validators.minLength(20)]],
      model_id: ['', [Validators.required]],
      prompt: ['', [Validators.required, Validators.minLength(10)]],
      temperature: [
        '',
        [Validators.required, Validators.min(0.1), Validators.max(1.0)],
      ],
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          // Mapear datos correctamente
          const formData = {
            user_id: data.user_id || data.user?.id,
            model_id: data.model_id || data.model?.id,
            temperature: data.temperature,
            prompt: data.prompt || '',
            api_key: '',
          };

          this.form.patchValue(formData);
          this.configId.set(data.id);
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
    this.form.statusChanges.subscribe(() => {
      this.isFormValid.set(this.form.valid);
    });
  }

  async fetchUsers(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userSrv.get().subscribe({
        next: (data) => {
          this.users.set(
            data.map((user: any) => ({
              value: user.id,
              label: `${user.full_name} (${user.email})`,
            })),
          );
          resolve();
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.users.error.load'),
            'error',
          );
          reject(err);
        },
      });
    });
  }

  async fetchModels(): Promise<void> {
    return new Promise((resolve) => {
      this.chatbotConfigSrv.getModels().subscribe({
        next: (data) => {
          this.models.set(
            data.map((model: any) => ({
              value: model.id,
              label: `${model.name} (${this.formatTokenLimit(
                model.daily_token_limit,
              )}/día)`,
              daily_token_limit: model.daily_token_limit, // Guardamos para referencia
            })),
          );
          resolve();
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.chatbot_config.error.loadModels',
            ),
            'error',
          );
        },
      });
    });
  }

  formatTokenLimit(limit: number): string {
    if (limit >= 1000000) {
      return `${(limit / 1000000).toFixed(1)}M`;
    } else if (limit >= 1000) {
      return `${(limit / 1000).toFixed(0)}K`;
    }
    return limit.toString();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.chatbot_config.error.formInvalid',
        ),
        'warning',
      );
      this.submitError.emit();
      return;
    }

    // Preparar payload
    const payload: any = {
      user_id: this.form.get('user_id')?.value,
      model_id: this.form.get('model_id')?.value,
      prompt: this.form.get('prompt')?.value.trim(),
      temperature: this.form.get('temperature')?.value,
    };

    // Solo incluir api_key si no está vacío (y en creación siempre es requerido)
    const apiKeyValue = this.form.get('api_key')?.value?.trim();
    if (apiKeyValue) {
      payload.api_key = apiKeyValue;
    } else if (!this.isEditing()) {
      // Si es creación y no hay API key, mostrar error
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.chatbot_config.error.apiKeyRequired',
        ),
        'error',
      );
      this.submitError.emit();
      return;
    }

    // Determinar si es creación o actualización
    let request$;
    if (this.isEditing() && this.configId()) {
      request$ = this.chatbotConfigSrv.patch(payload, this.configId()!);
    } else {
      request$ = this.chatbotConfigSrv.post(payload);
    }

    request$.subscribe({
      next: (response) => {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            this.isEditing()
              ? 'notifications.chatbot_config.success.updated'
              : 'notifications.chatbot_config.success.created',
          ),
          'success',
        );

        this.submitSuccess.emit();

        if (this.initialData()?.onSave) {
          this.initialData().onSave();
        }

        // Resetear formulario si no es edición
        if (!this.isEditing()) {
          this.form.reset({
            temperature: 0.2,
          });
        }
      },
      error: (error) => {
        let errorMessage = this.transloco.translate(
          this.isEditing()
            ? 'notifications.chatbot_config.error.update'
            : 'notifications.chatbot_config.error.create',
        );

        // Manejar errores específicos
        if (error.status === 400) {
          if (
            error.error?.detail?.includes('already exists') ||
            error.error?.detail?.includes('Ya existe')
          ) {
            errorMessage = this.transloco.translate(
              'notifications.chatbot_config.error.userExists',
            );
          } else if (error.error?.detail?.includes('invalid API key')) {
            errorMessage = this.transloco.translate(
              'notifications.chatbot_config.error.invalidApiKey',
            );
          }
        } else if (error.status === 409) {
          errorMessage = this.transloco.translate(
            'notifications.chatbot_config.error.userExists',
          );
        } else if (error.status === 404) {
          errorMessage = this.transloco.translate(
            'notifications.users.error.notFound',
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
