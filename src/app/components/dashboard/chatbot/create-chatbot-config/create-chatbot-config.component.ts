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
  selector: 'app-create-chatbot-config',
  templateUrl: './create-chatbot-config.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    SelectComponent,
  ],
})
export class CreateChatbotConfigComponent implements DynamicComponent {
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
  uploading = signal(false);
  isFormValid = signal(false);

  // Computed
  isSubmitting = signal<boolean>(false);
  isFormInvalid = computed(() => !this.isFormValid() || this.uploading());

  // Form
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      user_id: ['', [Validators.required]],
      api_key: ['', [Validators.required, Validators.minLength(20)]],
      model_id: ['', [Validators.required]],
      prompt: ['', [Validators.required, Validators.minLength(10)]],
    });

    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
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

    // Re-validar cuando cambie el usuario
    this.form.get('user_id')?.valueChanges.subscribe(() => {
      this.form.get('api_key')?.updateValueAndValidity();
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
            }))
          );
          resolve();
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.users.error.load'),
            'error'
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
              label: model.name,
            }))
          );
          resolve();
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

    const payload = {
      user_id: this.form.get('user_id')?.value,
      api_key: this.form.get('api_key')?.value.trim(),
      model_id: this.form.get('model_id')?.value,
      prompt: this.form.get('prompt')?.value.trim(),
    };

    this.chatbotConfigSrv.post(payload).subscribe({
      next: (response) => {
        this.uploading.set(false);

        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.chatbot_config.success.created'
          ),
          'success'
        );

        this.submitSuccess.emit();

        if (this.initialData()?.onSave) {
          this.initialData().onSave();
        }
      },
      error: (error) => {
        this.uploading.set(false);

        let errorMessage = this.transloco.translate(
          'notifications.chatbot_config.error.create'
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
