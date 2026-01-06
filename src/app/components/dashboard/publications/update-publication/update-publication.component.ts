import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  input,
  output,
  DestroyRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer } from '@angular/platform-browser';
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { PublicationsService } from '../../../../shared/services/features/publications.service';
import {
  Observable,
  of,
  switchMap,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-update-publication',
  templateUrl: './update-publication.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    SelectComponent,
    TranslocoModule,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatePublicationComponent implements DynamicComponent {
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
  loadingDocument = signal<boolean>(false);
  categories = signal<any[]>([]);
  selectedFile = signal<File | null>(null);
  selectedDocument = signal<File | null>(null);
  imageUrl = signal<string | null>(null);
  documentUrl = signal<string | null>(null);
  hasExistingDocument = signal<boolean>(false);
  existingDocumentName = signal<string | null>(null);

  // Computed signals
  isFormInvalid = computed(() => {
    return this.form.invalid || this.uploading();
  });

  documentIcon = computed(() => {
    const document = this.selectedDocument();
    const existingName = this.existingDocumentName();

    if (document) {
      const fileName = document.name.toLowerCase();
      if (fileName.endsWith('.pdf')) return 'pi-file-pdf';
      if (fileName.endsWith('.zip')) return 'zip';
      return 'pi-file';
    }

    if (this.hasExistingDocument() && existingName) {
      const fileName = existingName.toLowerCase();
      if (fileName.endsWith('.pdf')) return 'pi-file-pdf';
      if (fileName.endsWith('.zip')) return 'zip';
      return 'pi-file';
    }

    return 'pi-file';
  });

  documentIconColor = computed(() => {
    const document = this.selectedDocument();
    const existingName = this.existingDocumentName();

    if (document) {
      const fileName = document.name.toLowerCase();
      if (fileName.endsWith('.pdf')) return 'text-red-500';
      if (fileName.endsWith('.zip')) return 'text-green-500';
      return 'text-gray-400 dark:text-gray-500';
    }

    if (this.hasExistingDocument() && existingName) {
      const fileName = existingName.toLowerCase();
      if (fileName.endsWith('.pdf')) return 'text-red-500';
      if (fileName.endsWith('.zip')) return 'text-green-500';
      return 'text-gray-400 dark:text-gray-500';
    }

    return 'text-gray-400 dark:text-gray-500';
  });

  isZipFile = computed(() => {
    const document = this.selectedDocument();
    const existingName = this.existingDocumentName();

    if (document) {
      return document.name.toLowerCase().endsWith('.zip');
    }

    if (this.hasExistingDocument() && existingName) {
      return existingName.toLowerCase().endsWith('.zip');
    }

    return false;
  });

  documentName = computed(() => {
    const document = this.selectedDocument();
    const existingName = this.existingDocumentName();

    if (document) {
      return document.name;
    }

    if (this.hasExistingDocument() && existingName) {
      return existingName;
    }

    return '';
  });

  // Formulario
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      publication_category: ['', Validators.required],
      file: [''],
      photo: [''],
    });

    // Effects
    effect(() => {
      const data = this.initialData();
      if (data) {
        this.form.patchValue(data);
        this.form
          .get('publication_category')
          ?.setValue(data.publication_category?.id || '');
        this.id.set(data.id || 0);

        // Cargar archivos existentes
        if (data.photo) {
          this.loadCurrentImage(data.photo);
        }
        if (data.file) {
          this.loadCurrentDocument(data.file);
        }
      }
    });

    effect(() => {
      this.fetchCategories();
    });

    // Configurar validación asíncrona
    effect(() => {
      const titleControl = this.form.get('title');
      if (titleControl) {
        titleControl.setAsyncValidators([this.uniqueTitleValidator()]);
      }
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
      .patch(formData, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publications.success.updated'
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

          if (error.status === 400 && error.error?.message) {
            this.notificationSrv.addNotification(error.error.message, 'error');
          } else {
            const errorMessage =
              error.error?.message ||
              error.error?.detail ||
              this.transloco.translate(
                'notifications.publications.error.update'
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
            this.transloco.translate('notifications.categories.error.load'),
            'error'
          );
        },
      });
  }

  uniqueTitleValidator() {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const title = control.value?.trim().toLowerCase();
      const currentId = this.id();

      if (!title || title.length < 2) {
        return of(null);
      }

      return this.srv.get().pipe(
        map((publications: any[]) => {
          const exists = publications.some(
            (pub: any) =>
              pub.id !== currentId && pub.title?.trim().toLowerCase() === title
          );
          return exists ? { duplicateTitle: true } : null;
        }),
        catchError(() => {
          return of(null);
        })
      );
    };
  }

  onFileUploaded(files: File[]): void {
    const file = files[0];
    this.selectedFile.set(file);
    this.form.get('photo')?.setValue(file);

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

    // Marcar que ya no estamos usando el documento existente
    this.hasExistingDocument.set(false);
    this.existingDocumentName.set(null);
  }

  removeFile(): void {
    const oldUrl = this.imageUrl();
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.form.get('photo')?.setValue(null);
    this.form.markAllAsTouched();
  }

  removeDocument(): void {
    this.selectedDocument.set(null);
    this.hasExistingDocument.set(false);
    this.existingDocumentName.set(null);
    this.documentUrl.set(null);
    this.form.get('file')?.setValue(null);
    this.form.markAllAsTouched();
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

  private loadCurrentImage(photoUrl: string): void {
    this.loadingImage.set(true);

    this.srv
      .getImage(photoUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            this.imageUrl.set(reader.result as string);
            this.form.get('photo')?.setValue('existing-image');
            this.loadingImage.set(false);
          };
          reader.readAsDataURL(new Blob([blob]));
        },
        error: () => {
          this.imageUrl.set(photoUrl);
          this.form.get('photo')?.setValue('existing-image');
          this.loadingImage.set(false);
        },
      });
  }

  private loadCurrentDocument(fileUrl: string): void {
    this.loadingDocument.set(true);

    // Extraer el nombre del archivo de la URL
    const urlParts = fileUrl.split('/');
    const documentName = urlParts[urlParts.length - 1];

    this.existingDocumentName.set(documentName);
    this.hasExistingDocument.set(true);
    this.documentUrl.set(fileUrl);

    this.form.get('file')?.setValue('existing-document');
    this.loadingDocument.set(false);
  }
}
