import {
  Component,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
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
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MetricsService,
  MetricEvent,
} from '../../../../shared/services/features/metrics.service';

@Component({
  selector: 'app-create-edit-statistic',
  templateUrl: './create-edit-statistic.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    TranslocoModule,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEditStatisticComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(MetricsService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  uploading = signal<boolean>(false);

  // Formulario
  form: FormGroup;

  // Computed para detectar modo
  isEdit = computed(() => !!this.initialData()?.event_name);

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  constructor() {
    this.form = this.fb.group({
      event_name: ['', [Validators.required, Validators.minLength(3)]],
      label: ['', [Validators.required, Validators.minLength(3)]],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.initializeForm(data);
        });
      }
    });

    // Effect para emitir validez del formulario
    effect(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  t(suffix: string): string {
    const prefix = this.isEdit()
      ? 'components.statistics.edit'
      : 'components.statistics.create';
    return this.transloco.translate(`${prefix}.${suffix}`);
  }

  private initializeForm(data: any): void {
    this.form.patchValue(data);

    // En modo edición, deshabilitar el campo event_name
    if (this.isEdit()) {
      this.form.get('event_name')?.disable();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.statistics.error.formInvalid'),
        'warning',
      );

      this.submitError.emit();
      return;
    }

    // En modo edición, usar el event_name original, no el del formulario
    const event_name = this.isEdit()
      ? this.initialData()?.event_name
      : this.form.get('event_name')?.value.trim();
    const label = this.form.get('label')?.value.trim();

    this.uploading.set(true);

    const subscription$ = this.isEdit()
      ? this.srv.updateEvent(event_name, label)
      : this.srv.addEvent(event_name, label);

    subscription$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.uploading.set(false);

        const messageKey = this.isEdit()
          ? 'notifications.statistics.success.updated'
          : 'notifications.statistics.success.created';

        this.notificationSrv.addNotification(
          this.transloco.translate(messageKey),
          'success',
        );
        this.submitSuccess.emit();

        const data = this.initialData();
        if (data?.onSave) {
          data.onSave();
        }

        if (!data?.closeOnSubmit) {
          this.resetForm();
        }
      },
      error: (error) => {
        this.uploading.set(false);
        this.handleError(error, this.isEdit());
        this.submitError.emit();
      },
    });
  }

  private handleError(error: any, isUpdate: boolean): void {
    const messageKey = isUpdate
      ? 'notifications.statistics.error.update'
      : 'notifications.statistics.error.create';

    this.notificationSrv.addNotification(
      this.transloco.translate(messageKey),
      'error',
    );
  }

  private resetForm(): void {
    this.form.reset({
      event_name: '',
      label: '',
    });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
