import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
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
import { CarouselService } from '../../../shared/services/features/carousel.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-update-carousel',
  templateUrl: './update-carousel.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    TooltipModule,
  ],
})
export class UpdateCarouselComponent implements DynamicComponent {
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
    private srv: CarouselService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService
  ) {
    this.form = this.fb.group({
      title: [
        null,
        [
          Validators.minLength(1),
        ],
      ],
      description: [null, [Validators.minLength(3)]],
      image: [null, Validators.required],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    if (this.initialData) {
      this.form.patchValue(this.initialData);

      this.id = this.initialData.id;

      if (this.initialData.photo) {
        this.loadCurrentImage();
      }
    }
  }

  private loadCurrentImage(): void {
    if (this.initialData?.photo) {
      this.loadingImage = true;

      this.srv.getImage(this.initialData.photo).subscribe({
        next: (blob: Blob) => {
          this.createImagePreview(blob);
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage = false;
        },
        error: () => {
          this.setFallbackImage();
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage = false;
        },
      });
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

  private createImagePreview(blob: Blob): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.imageUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(): void {
    this.imageUrl = this.initialData.route;
    this.cdr.detectChanges();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      const message = this.transloco.translate(
        'notifications.carousel.error.formInvalid'
      );
      this.notificationSrv.addNotification(message, 'warning');
      this.form.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    const titleCtrl = this.form.get('title');
    const descCtrl = this.form.get('description');
    const title: string | null = titleCtrl?.value;
    const description: string | null = descCtrl?.value;

    // Título: enviar si tiene contenido; si el usuario lo borró explícitamente (touched y vacío), enviar cadena vacía
    if (title && title.trim().length > 0) {
      formData.append('title', title.trim());
    } else if (titleCtrl?.touched) {
      formData.append('title', '');
    }

    // Descripción: misma lógica que título, pero preservando saltos de línea
    if (description && description.trim().length > 0) {
      // Preservar saltos de línea - no hacer trim completo, solo espacios al inicio/fin de cada línea
      const processedDescription = description
        .split('\n')
        .map((line: string) => line.trimEnd())
        .join('\n')
        .replace(/^\s+/, '')
        .replace(/\s+$/, '');
      formData.append('description', processedDescription);
    } else if (descCtrl?.touched) {
      formData.append('description', '');
    }

    if (this.selectedFile) {
      formData.append('photo', this.selectedFile, this.selectedFile.name);
    }

    this.uploading = true;

    this.srv.patch(formData, this.id).subscribe({
      next: (response) => {
        this.uploading = false;
        // Actualizar la vista previa con la ruta del backend

        this.imageUrl = null;
        this.form.patchValue({ route: '' });

        const message = this.transloco.translate(
          'notifications.carousel.success.updated'
        );
        this.notificationSrv.addNotification(message, 'success');
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
            'La imagen que esta intentando subir ya se encuentra en el servidor."The image you are trying to upload is already on the server."'
          )
        ) {
          const message = this.transloco.translate(
            'notifications.carousel.error.duplicateImage'
          );
          this.notificationSrv.addNotification(message, 'error');
        } else {
          const message = this.transloco.translate(
            'notifications.carousel.error.update'
          );
          this.notificationSrv.addNotification(message, 'error');
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

    console.error('Error de validación de archivo:"File validation error:"', {
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
