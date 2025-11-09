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
import { CommonModule } from '@angular/common';
import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../shared/interfaces/fileUpload.interface';
import { SelectComponent } from '../../../shared/components/app-select/app-select.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer } from '@angular/platform-browser';
import { PublicationCategoryService } from '../../../shared/services/features/publication-category.service';
import { PublicationsService } from '../../../shared/services/features/publications.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-update-publication',
  templateUrl: './update-publication.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TextFieldComponent,
    AppFileUploadComponent,
    SelectComponent,
    TranslocoModule,
    TooltipModule,
  ],
})
export class UpdatePublicationComponent implements DynamicComponent {
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
  loadingDocument = false;
  imageUrl: string | null = null;
  documentUrl: string | null = null;
  // Nuevas propiedades para distinguir entre archivos existentes y nuevos
  hasExistingDocument = false;
  existingDocumentName: string | null = null;

  constructor(
    private fb: FormBuilder,
    private srv: PublicationsService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef,
    private categorySrv: PublicationCategoryService,
    private sanitizer: DomSanitizer
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      publication_category: ['', Validators.required],
      file: [''],
      photo: [''],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.initialData) {
      console.log(this.initialData);
      this.form.patchValue(this.initialData);
      this.form
        .get('publication_category')
        ?.setValue(this.initialData.publication_category.id);
      this.id = this.initialData.id;

      // Load existing files if they exist
      if (this.initialData.photo) {
        this.loadCurrentImage();
      }
      if (this.initialData.file) {
        this.loadCurrentDocument();
      }
    }

    const initTasks = [this.fetchCategories(), this.fetchPublications()];
    await Promise.all(initTasks);

    // Agregar el validador asíncrono después de inicializar
    this.form.get('title')?.setAsyncValidators([this.uniqueTitleValidator()]);
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

    this.srv.patch(formData, this.id).subscribe({
      next: (response) => {
        this.uploading = false;
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.publications.success.updated'
          ),
          'success'
        );
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }
      },
      error: (error) => {
        this.uploading = false;

        if (
          error.status === 400 &&
          error.error?.message &&
          error.error.message.includes(
            'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."'
          )
        ) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          const errorMessage =
            error.error?.message ||
            error.error?.detail ||
            this.transloco.translate('notifications.publications.error.update');

          this.notificationSrv.addNotification(errorMessage, 'error');
        }
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid || this.uploading;
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
            this.transloco.translate('notifications.categories.error.load'),
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
      
      if (!title || title.length < 2) {
        return of(null);
      }

      return this.srv.get().pipe(
        map((publications: any[]) => {
          // Exclude current publication from the check
          const exists = publications.some(
            (pub: any) =>
              pub.id !== this.id &&
              pub.title?.trim().toLowerCase() === title
          );
          return exists ? { duplicateTitle: true } : null;
        }),
        catchError(() => {
          // Fallback to local publications array if API call fails
          const exists = this.publications.some(
            (pub: any) =>
              pub.id !== this.id &&
              pub.title?.trim().toLowerCase() === title
          );
          return of(exists ? { duplicateTitle: true } : null);
        })
      );
    };
  }

  onFileUploaded(files: File[]): void {
    const file = files[0];
    this.selectedFile = file;
    this.form.get('photo')?.setValue(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  onDocumentUploaded(files: File[]): void {
    const file = files[0];
    this.selectedDocument = file;
    this.form.get('file')?.setValue(file);

    // Marcar que ya no estamos usando el documento existente
    this.hasExistingDocument = false;
    this.existingDocumentName = null;

    // Actualizar la vista
    this.cdr.detectChanges();
  }

  getDocumentIcon(): string {
    // Prioridad: archivo nuevo seleccionado
    if (this.selectedDocument) {
      const fileName = this.selectedDocument.name.toLowerCase();
      if (fileName.endsWith('.pdf')) {
        return 'pi-file-pdf';
      } else if (fileName.endsWith('.zip')) {
        return 'zip';
      }
      return 'pi-file';
    }

    // Si hay documento existente
    if (this.hasExistingDocument && this.existingDocumentName) {
      const fileName = this.existingDocumentName.toLowerCase();
      if (fileName.endsWith('.pdf')) {
        return 'pi-file-pdf';
      } else if (fileName.endsWith('.zip')) {
        return 'zip';
      }
      return 'pi-file';
    }

    return 'pi-file';
  }

  getDocumentIconColor(): string {
    // Prioridad: archivo nuevo seleccionado
    if (this.selectedDocument) {
      const fileName = this.selectedDocument.name.toLowerCase();
      if (fileName.endsWith('.pdf')) {
        return 'text-red-500';
      } else if (fileName.endsWith('.zip')) {
        return 'text-green-500';
      }
      return 'text-gray-400 dark:text-gray-500';
    }

    // Si hay documento existente
    if (this.hasExistingDocument && this.existingDocumentName) {
      const fileName = this.existingDocumentName.toLowerCase();
      if (fileName.endsWith('.pdf')) {
        return 'text-red-500';
      } else if (fileName.endsWith('.zip')) {
        return 'text-green-500';
      }
      return 'text-gray-400 dark:text-gray-500';
    }

    return 'text-gray-400 dark:text-gray-500';
  }

  isZipFile(): boolean {
    if (this.selectedDocument) {
      return this.selectedDocument.name.toLowerCase().endsWith('.zip');
    }
    if (this.hasExistingDocument && this.existingDocumentName) {
      return this.existingDocumentName.toLowerCase().endsWith('.zip');
    }
    return false;
  }

  getDocumentName(): string {
    if (this.selectedDocument) {
      return this.selectedDocument.name;
    }
    if (this.hasExistingDocument && this.existingDocumentName) {
      return this.existingDocumentName;
    }
    return '';
  }

  removeFile(): void {
    this.selectedFile = null;
    this.imageUrl = null;
    this.form.get('photo')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ photo: null });
    this.cdr.detectChanges();
  }

  removeDocument(): void {
    this.selectedDocument = null;
    this.hasExistingDocument = false;
    this.existingDocumentName = null;
    this.documentUrl = null;
    this.form.get('file')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ file: null });
    this.cdr.detectChanges();
  }

  private createImagePreview(blob: Blob): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(): void {
    this.imageUrl = this.initialData.photo;
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

  private loadCurrentImage(): void {
    if (this.initialData?.photo) {
      this.loadingImage = true;

      this.srv.getImage(this.initialData.photo).subscribe({
        next: (blob: Blob) => {
          this.createImagePreview(blob);
          this.form.get('photo')?.setValue('existing-image');
          this.loadingImage = false;
        },
        error: () => {
          this.setFallbackImage();
          this.form.get('photo')?.setValue('existing-image');
          this.loadingImage = false;
        },
      });
    }
  }

  private loadCurrentDocument(): void {
    if (this.initialData?.file) {
      this.loadingDocument = true;

      // Extraer el nombre del archivo de la URL
      const urlParts = this.initialData.file.split('/');
      this.existingDocumentName = urlParts[urlParts.length - 1];
      this.hasExistingDocument = true;
      this.documentUrl = this.initialData.file;

      this.form.get('file')?.setValue('existing-document');
      this.loadingDocument = false;
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    // Limpiar todas las URLs de objetos si es necesario
  }
}
