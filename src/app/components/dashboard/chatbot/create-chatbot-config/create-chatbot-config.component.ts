import {
  Component,
  inject,
  Input,
  output,
  signal,
  effect,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  AsyncValidatorFn,
  FormControl,
} from '@angular/forms';
import { map, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
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

  @Input() initialData?: any;

  // Outputs con signals (Nueva API de Angular 17.3+)
  formValid = output<boolean>();
  submitSuccess = output<void>();

  // Signals
  models: any = [
    {
      value: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B (Versatile)',
    },
    {
      value: 'llama-3.1-70b-versatile',
      label: 'Llama 3.1 70B (Versatile)',
    },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Instant)' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ];
  users = signal<any[]>([]);
  uploading = signal(false);
  isFormValid = signal(false);

  // Computed
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

  async ngOnInit() {
    if (this.initialData) {
      this.form.patchValue(this.initialData);
    }

    await Promise.all([this.fetchUsers(), this.fetchModels()]);
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
    return new Promise((resolve, reject) => {
      this.chatbotConfigSrv.getModels().subscribe({
        next: (data) => {
          this.models.set(
            data.map((model: any) => ({
              value: model.id,
              label: model.display_name,
            }))
          );
          resolve();
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.chatbot.error.loadModels'),
            'error'
          );
          reject(err);
        },
      });
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.chatbot.error.formInvalid'),
        'warning'
      );
      this.form.markAllAsTouched();
      return;
    }

    this.uploading.set(true);

    const payload = {
      user_id: this.form.get('user_id')?.value,
      groq_api_key: this.form.get('api_key')?.value.trim(),
      groq_model: this.form.get('gmodel')?.value,
      prompt: this.form.get('prompt')?.value.trim(),
    };

    this.chatbotConfigSrv.post(payload).subscribe({
      next: (response) => {
        this.uploading.set(false);

        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.chatbot.success.created'),
          'success'
        );

        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }
      },
      error: (error) => {
        this.uploading.set(false);

        let errorMessage = this.transloco.translate(
          'notifications.chatbot.error.create'
        );

        // Manejar errores específicos
        if (error.status === 400) {
          if (error.error?.message?.includes('already exists')) {
            errorMessage = this.transloco.translate(
              'notifications.chatbot.error.userExists'
            );
          } else if (error.error?.message?.includes('invalid API key')) {
            errorMessage = this.transloco.translate(
              'notifications.chatbot.error.invalidApiKey'
            );
          }
        }

        this.notificationSrv.addNotification(errorMessage, 'error');
      },
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
