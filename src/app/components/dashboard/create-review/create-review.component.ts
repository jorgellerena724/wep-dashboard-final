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
import { ReviewService } from '../../../shared/services/features/review.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-create-review',
  templateUrl: './create-review.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
  ],
})
export class CreateReviewComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  selectedFile: File | null = null;
  uploading = false;
  loadingImage = false;
  imageUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private srv: ReviewService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: ['', Validators.required],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.initialData) {
      this.form.patchValue(this.initialData);
    }
  }

  onFileSelected(file: File) {
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  onFileUploaded(file: File): void {
    this.selectedFile = file;
    this.form.get('image')?.setValue(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.notificationSrv.addNotification(
        'Compruebe los campos del formulario.',
        'warning'
      );
      this.form.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    formData.append('description', this.form.get('description')?.value);

    if (this.selectedFile) {
      formData.append('photo', this.selectedFile, this.selectedFile.name);
    }

    this.uploading = true;

    this.srv.post(formData).subscribe({
      next: (response) => {
        this.uploading = false;
        // Actualizar la vista previa con la ruta del backend

        this.imageUrl = null;
        this.form.patchValue({ photo: '' });

        this.notificationSrv.addNotification(
          'Reseña registrada correctamente.',
          'success'
        );
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }

        if (!this.initialData?.closeOnSubmit) {
          this.form.reset();
          this.selectedFile = null;
          this.imageUrl = null;
        }
      },
      error: (error) => {
        this.uploading = false;

        if (
          error.status === 400 &&
          error.error.message.includes(
            'La imagen que esta intentando subir ya se encuentra en el servidor'
          )
        ) {
          this.notificationSrv.addNotification(error.error.message, 'error');
        } else {
          this.notificationSrv.addNotification(
            'Error al registrar la reseña.',
            'error'
          );
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

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');

    console.error('Error de validación de archivo:', {
      type: error.type,
      message: error.message,
      fileName: error.file.name,
      fileSize: error.file.size,
      fileType: error.file.type,
    });

    this.selectedFile = null;
  }

  ngOnDestroy() {
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
    }
  }
}
