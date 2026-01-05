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
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { PublicationsService } from '../../../../shared/services/features/publications.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-publication',
  templateUrl: './create-publication.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    SelectComponent,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePublicationComponent implements DynamicComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  private srv = inject(PublicationsService);
  private notificationSrv = inject(NotificationService);
  private categorySrv = inject(PublicationCategoryService);
  private destroyRef = inject(DestroyRef);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);
  loadingImage = signal<boolean>(false);
  categories = signal<any[]>([]);
  selectedFile = signal<File | null>(null);
  selectedDocument = signal<File | null>(null);
  imageUrl = signal<string | null>(null);

  // Formulario
  form: FormGroup;

  // Computed para facilitar acceso en template
  isFormInvalidComputed = signal<boolean>(false);

  documentIcon = computed(() => {
    const document = this.selectedDocument();
    if (!document) return 'pi-file';

    const fileName = document.name.toLowerCase();
    if (fileName.endsWith('.pdf')) return 'pi-file-pdf';
    if (fileName.endsWith('.zip')) return 'zip';
    return 'pi-file';
  });

  documentIconColor = computed(() => {
    const document = this.selectedDocument();
    if (!document) return 'text-gray-400 dark:text-gray-500';

    const fileName = document.name.toLowerCase();
    if (fileName.endsWith('.pdf')) return 'text-red-500';
    if (fileName.endsWith('.zip')) return 'text-green-500';
    return 'text-gray-400 dark:text-gray-500';
  });

  isZipFile = computed(() => {
    const document = this.selectedDocument();
    return document?.name.toLowerCase().endsWith('.zip') || false;
  });

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      publication_category: ['', Validators.required],
      image: [''],
      file: ['', Validators.required],
    });

    // Effects
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);
        });
      }
    });

    effect(() => {
      this.fetchCategories();
    });

    effect(() => {
      const invalid = this.form.invalid || this.uploading();
      this.isFormInvalidComputed.set(invalid);
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
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

  onDocumentUploaded(files: File[]): void {
    const file = files[0];
    this.selectedDocument.set(file);
    this.form.get('file')?.setValue(file);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate(
          'notifications.publications.error.formInvalid'
        ),
        'warning'
      );
      this.form.markAllAsTouched();

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);
    formData.append(
      'publication_category_id',
      this.form.get('publication_category')?.value
    );

    const selectedFile = this.selectedFile();
    if (selectedFile) {
      formData.append('photo', selectedFile, selectedFile.name);
    }

    const selectedDocument = this.selectedDocument();
    if (selectedDocument) {
      formData.append('file', selectedDocument, selectedDocument.name);
    }

    this.uploading.set(true);

    this.srv
      .post(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.imageUrl.set(null);
          this.form.patchValue({ photo: '' });

          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publications.success.created'
            ),
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

          if (
            error.status === 400 &&
            error.error?.message &&
            error.error.message.includes(
              'La imagen que esta intentando subir ya se encuentra en el servidor'
            )
          ) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            const errorMessage =
              error.error?.message ||
              error.error?.detail ||
              this.transloco.translate(
                'notifications.publications.error.create'
              );

            this.notificationSrv.addNotification(errorMessage, 'error');
          }

          this.submitError.emit();
        },
      });
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  removeFile(): void {
    const oldUrl = this.imageUrl();
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
  }

  removeDocument(): void {
    this.selectedDocument.set(null);
    this.form.get('file')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ file: null });
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
    console.error('Error de validación de archivo:', error);
    this.selectedFile.set(null);
  }

  onDocumentError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
    console.error('Error de validación de documento:', error);
    this.selectedDocument.set(null);
  }

  private fetchCategories(): void {
    this.categorySrv
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.categories.set(
            data.map((com: any) => ({
              value: com.id,
              label: com.title,
            }))
          );
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publication-category.error.load'
            ),
            'error'
          );
        },
      });
  }

  private resetForm(): void {
    this.form.reset();
    this.selectedFile.set(null);
    this.selectedDocument.set(null);
    this.imageUrl.set(null);
  }
}
