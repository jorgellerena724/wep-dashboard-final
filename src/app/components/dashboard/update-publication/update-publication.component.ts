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
      this.form.patchValue(this.initialData);
      this.form
        .get('publication_category')
        ?.setValue(this.initialData.category.id);
      this.id = this.initialData.id;
    }

    const initTasks = [this.fetchCategories()];
    await Promise.all(initTasks);
  }
  async onSubmit(): Promise<void> {
    // Verificar que haya al menos un archivo
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      this.form.markAllAsTouched();

      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);
    formData.append('description', this.form.get('description')?.value);
    formData.append(
      'publication_category_id',
      this.form.get('publication_category')?.value
    );

    this.uploading = true;

    this.srv.patch(formData, this.id).subscribe({
      next: (response) => {
        this.uploading = false;
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.products.success.updated'),
          'success'
        );
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }
      },
      error: (error) => {
        this.uploading = false;

        // Manejar error de imagen duplicada
        if (
          error.status === 400 &&
          error.error.message?.includes('imagen') &&
          error.error.message?.includes('servidor')
        ) {
          this.notificationSrv.addNotification(
            this.transloco.translate(
              'notifications.products.error.duplicateImage'
            ),
            'error'
          );
        } else {
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.products.error.update'),
            'error'
          );
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

  ngOnDestroy() {
    // Limpiar todas las URLs de objetos
  }
}
