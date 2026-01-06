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
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { ReviewService } from '../../../../shared/services/features/review.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-update-review',
  templateUrl: './update-review.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateReviewComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ReviewService);
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
  selectedFile = signal<File | null>(null);
  uploading = signal<boolean>(false);
  loadingImage = signal<boolean>(false);
  imageUrl = signal<string | null>(null);

  // Formulario
  form: FormGroup;

  // Computed para validación
  isFormInvalid = computed(() => this.form.invalid || this.uploading());

  // Computed para traducciones de error
  formInvalidMessage = computed(() =>
    this.transloco.translate('notifications.reviews.error.formInvalid')
  );

  updatedMessage = computed(() =>
    this.transloco.translate('notifications.reviews.success.updated')
  );

  updateErrorMessage = computed(() =>
    this.transloco.translate('notifications.reviews.error.update')
  );

  duplicateImageMessage = computed(() =>
    this.transloco.translate('notifications.reviews.error.duplicateImage')
  );

  constructor() {
    this.form = this.fb.group({
      id: [''],
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: [''], // Sin validador required en update
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

  private initializeForm(data: any): void {
    this.form.patchValue(data);
    this.id.set(data.id || 0);

    if (data.photo) {
      this.loadCurrentImage();
    }
  }

  private loadCurrentImage(): void {
    const data = this.initialData();
    if (!data?.photo) return;

    this.loadingImage.set(true);

    this.srv
      .getImage(data.photo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          this.createImagePreview(blob);
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
        error: () => {
          this.setFallbackImage();
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
      });
  }

  onFileSelected(file: File): void {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  onFileUploaded(files: File[]): void {
    const file = files[0];
    this.selectedFile.set(file);
    this.form.get('image')?.setValue(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  private createImagePreview(blob: Blob): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.imageUrl.set(reader.result as string);
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(): void {
    const data = this.initialData();
    this.imageUrl.set(data?.photo || null);
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
    formData.append('id', this.form.get('id')?.value);
    formData.append('title', this.form.get('title')?.value);

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value;
    const processedDescription = description
      .split('\n')
      .map((line: string) => line.trimEnd())
      .join('\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    formData.append('description', processedDescription);

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    }

    this.uploading.set(true);

    this.srv
      .patch(formData, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.imageUrl.set(null);
          this.form.patchValue({ photo: '' });

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
            this.resetForm();
          }
        },
        error: (error) => {
          this.uploading.set(false);
          this.handleError(error);
          this.submitError.emit();
        },
      });
  }

  private handleError(error: any): void {
    if (
      error.status === 400 &&
      error.error.message.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."'
      )
    ) {
      this.notificationSrv.addNotification(
        this.duplicateImageMessage(),
        'error'
      );
    } else {
      this.notificationSrv.addNotification(this.updateErrorMessage(), 'error');
    }
  }

  private resetForm(): void {
    this.form.reset();
    this.selectedFile.set(null);
    this.imageUrl.set(null);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
    this.selectedFile.set(null);
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
