import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  AsyncValidatorFn,
} from '@angular/forms';
import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../shared/interfaces/fileUpload.interface';
import { PublicationsService } from '../../../shared/services/features/publications.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SelectComponent } from '../../../shared/components/app-select/app-select.component';
import { PublicationCategoryService } from '../../../shared/services/features/publication-category.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TooltipModule } from 'primeng/tooltip';

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
})
export class CreatePublicationComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  categories: any[] = [];
  publications: any[] = [];
  selectedFile: File | null = null;
  selectedDocument: File | null = null;
  uploading = false;
  loadingImage = false;
  imageUrl: string | null = null;
  documentUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private srv: PublicationsService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef,
    private categorySrv: PublicationCategoryService
  ) {
    this.form = this.fb.group({
      title: [
        '',
        [Validators.required, Validators.minLength(3)],
        [this.uniqueTitleValidator()],
      ],
      publication_category: ['', Validators.required],
      image: [''],
      file: ['', Validators.required],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit() {
    if (this.initialData) {
      this.form.patchValue(this.initialData);
    }

    const initTasks = [this.fetchCategories(), this.fetchPublications()];
    await Promise.all(initTasks);
  }

  onFileSelected(file: File) {
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onFileUploaded(files: File[]): void {
    const file = files[0]; // Only handle the first file since this component supports single file upload
    this.selectedFile = file;
    this.form.get('image')?.setValue(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  onDocumentUploaded(files: File[]): void {
    const file = files[0]; // Only handle the first file since this component supports single file upload
    this.selectedDocument = file;
    this.form.get('file')?.setValue(file);
    // For documents, we don't need to preview, just store the file
    this.cdr.detectChanges();
  }

  getDocumentIcon(): string {
    if (!this.selectedDocument) {
      return 'pi-file';
    }

    const fileName = this.selectedDocument.name.toLowerCase();
    if (fileName.endsWith('.pdf')) {
      return 'pi-file-pdf';
    } else if (fileName.endsWith('.zip')) {
      return 'zip';
    }

    return 'pi-file';
  }

  getDocumentIconColor(): string {
    if (!this.selectedDocument) {
      return 'text-gray-400 dark:text-gray-500';
    }

    const fileName = this.selectedDocument.name.toLowerCase();
    if (fileName.endsWith('.pdf')) {
      return 'text-red-500';
    } else if (fileName.endsWith('.zip')) {
      return 'text-green-500';
    }

    return 'text-gray-400 dark:text-gray-500';
  }

  isZipFile(): boolean {
    return this.selectedDocument?.name.toLowerCase().endsWith('.zip') || false;
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
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);
    formData.append(
      'publication_category_id',
      this.form.get('publication_category')?.value
    );

    if (this.selectedFile) {
      formData.append('photo', this.selectedFile, this.selectedFile.name);
    }

    if (this.selectedDocument) {
      formData.append(
        'file',
        this.selectedDocument,
        this.selectedDocument.name
      );
    }

    this.uploading = true;

    this.srv.post(formData).subscribe({
      next: (response) => {
        this.uploading = false;
        // Actualizar la vista previa con la ruta del backend

        this.imageUrl = null;
        this.form.patchValue({ photo: '' });

        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.publications.success.created'
          ),
          'success'
        );
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }

        if (!this.initialData?.closeOnSubmit) {
          this.form.reset();
          this.selectedFile = null;
          this.selectedDocument = null;
          this.imageUrl = null;
          this.documentUrl = null;
        }
      },
      error: (error) => {
        this.uploading = false;

        // Verificar si existe el mensaje de error y si contiene el texto específico
        if (
          error.status === 400 &&
          error.error?.message &&
          error.error.message.includes(
            'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."'
          )
        ) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          // Mostrar el mensaje de error del backend si existe, sino mostrar el mensaje genérico
          const errorMessage =
            error.error?.message ||
            error.error?.detail ||
            this.transloco.translate('notifications.publications.error.create');

          this.notificationSrv.addNotification(errorMessage, 'error');
        }
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid || this.uploading;
  }

  removeFile(): void {
    if (this.selectedFile) {
      this.selectedFile = null;
    }
    this.imageUrl = null;
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
    this.cdr.detectChanges();
  }

  removeDocument(): void {
    if (this.selectedDocument) {
      this.selectedDocument = null;
    }
    this.documentUrl = null;
    this.form.get('file')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ file: null });
    this.cdr.detectChanges();
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');

    console.error('Error de validación de archivo:"File validation error:"', {
      type: error.type,
      message: error.message,
      fileName: error.file.name,
      fileSize: error.file.size,
      fileType: error.file.type,
    });

    this.selectedFile = null;
  }

  onDocumentError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');

    console.error(
      'Error de validación de documento:"Document validation error:"',
      {
        type: error.type,
        message: error.message,
        fileName: error.file.name,
        fileSize: error.file.size,
        fileType: error.file.type,
      }
    );

    this.selectedDocument = null;
  }

  fetchCategories(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categorySrv.get().subscribe({
        next: (data) => {
          this.categories = data.map((com: any) => ({
            value: com.id,
            label: com.title,
          }));
          resolve();
        },
        error: (err) => {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.publication-category.error.load'
            ),
            'error'
          );
          reject(err);
        },
      });
    });
  }

  fetchPublications(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.srv.get().subscribe({
        next: (data) => {
          this.publications = data || [];
          resolve();
        },
        error: (err) => {
          // Silently fail - validation will work without preloaded data
          this.publications = [];
          resolve();
        },
      });
    });
  }

  uniqueTitleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const title = control.value?.trim().toLowerCase();

      if (!title || title.length < 3) {
        return of(null);
      }

      return this.srv.get().pipe(
        map((publications: any[]) => {
          const exists = publications.some(
            (pub: any) => pub.title?.trim().toLowerCase() === title
          );
          return exists ? { duplicateTitle: true } : null;
        }),
        catchError(() => {
          // Fallback to local publications array if API call fails
          const exists = this.publications.some(
            (pub: any) => pub.title?.trim().toLowerCase() === title
          );
          return of(exists ? { duplicateTitle: true } : null);
        })
      );
    };
  }

  ngOnDestroy() {
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
    }
    if (this.documentUrl) {
      URL.revokeObjectURL(this.documentUrl);
    }
  }
}
