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
} from '@angular/forms';

import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../shared/interfaces/fileUpload.interface';
import { NewsService } from '../../../shared/services/features/news.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HomeData } from '../../../shared/interfaces/home.interface';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-update-news',
  templateUrl: './update-news.component.html',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    AppFileUploadComponent,
    TranslocoModule,
    TooltipModule
],
})
export class UpdateNewsComponent implements DynamicComponent {
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
  isVideo: boolean = false;
  videoUrl: SafeResourceUrl | null = null;
  existingNews: HomeData[] = [];

  constructor(
    private fb: FormBuilder,
    private srv: NewsService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {
    this.form = this.fb.group({
      title: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
        ],
        [this.duplicateNameValidator.bind(this)],
      ],
      description: ['', [Validators.required, Validators.minLength(3)]],
      fecha: [''],
      image: [null, Validators.required],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    this.loadExistingNews();
    if (this.initialData) {
      this.form.patchValue(this.initialData);

      this.id = this.initialData.id;

      if (this.initialData.photo) {
        this.loadCurrentImage();
      }
    }
  }

  loadExistingNews(): void {
    this.srv.get().subscribe({
      next: (news) => {
        this.existingNews = news || [];
        // Actualizar validación después de cargar noticias
        const titleControl = this.form.get('title');
        if (titleControl && titleControl.value) {
          titleControl.updateValueAndValidity();
        }
      },
      error: (error) => {
        console.error('Error loading news:', error);
      },
    });
  }

  duplicateNameValidator(control: AbstractControl): Promise<ValidationErrors | null> {
    return new Promise((resolve) => {
      const title = control.value?.trim().toLowerCase();
      if (!title) {
        resolve(null);
        return;
      }

      const isDuplicate = this.existingNews.some(
        (news) =>
          news.title?.trim().toLowerCase() === title &&
          news.id !== this.id
      );

      if (isDuplicate) {
        resolve({ duplicateName: true });
      } else {
        resolve(null);
      }
    });
  }

  private loadCurrentImage(): void {
    if (this.initialData?.photo) {
      this.loadingImage = true;

      // Determinar si es video por la extensión
      const extension = this.initialData.photo.split('.').pop()?.toLowerCase();
      this.isVideo = ['mp4', 'webm', 'mov'].includes(extension || '');

      this.srv.getImage(this.initialData.photo).subscribe({
        next: (blob: Blob) => {
          if (this.isVideo) {
            this.createVideoPreview(blob, extension);
          } else {
            this.createImagePreview(blob);
          }
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage = false;
        },
        error: () => {
          if (this.isVideo) {
            this.setFallbackVideo();
          } else {
            this.setFallbackImage();
          }
          this.form.get('image')?.setValue('existing-image');
          this.loadingImage = false;
        },
      });
    }
  }

  private createVideoPreview(blob: Blob, extension: string | undefined): void {
    // Determinar el tipo MIME basado en la extensión
    let mimeType = 'video/mp4';
    if (extension === 'mov') mimeType = 'video/quicktime';
    if (extension === 'webm') mimeType = 'video/webm';
    if (extension === 'ogg') mimeType = 'video/ogg';

    // Crear URL segura para el video
    const videoBlob = new Blob([blob], { type: mimeType });
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      URL.createObjectURL(videoBlob)
    );
    this.cdr.detectChanges();
  }

  // Añadir método para fallback de video
  private setFallbackVideo(): void {
    // Usar sanitizer para URL externa
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.initialData.photo
    );
    this.cdr.detectChanges();
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

    // Determinar si es video (incluyendo .mov)
    const supportedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
    ];

    this.isVideo = supportedVideoTypes.includes(file.type);

    if (this.isVideo) {
      // Crear URL segura para el video
      const videoUrl = URL.createObjectURL(file);
      this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
      this.imageUrl = null;
    } else {
      // Para imágenes
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl = reader.result as string;
        this.videoUrl = null;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
    this.cdr.detectChanges();
  }

  removeFile(): void {
    if (this.selectedFile) {
      this.selectedFile = null;
    }

    // Revocar URLs de objetos
    if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imageUrl);
    }
    if (this.videoUrl) {
      // Para SafeResourceUrl, necesitamos acceder a la URL real
      const unsafeUrl = this.videoUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }

    this.imageUrl = null;
    this.videoUrl = null;
    this.isVideo = false;
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
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

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      if (this.form.get('title')?.errors?.['duplicateName']) {
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.news.error.duplicateName'),
          'warning'
        );
      } else {
        const message = this.transloco.translate(
          'notifications.news.error.formInvalid'
        );
        this.notificationSrv.addNotification(message, 'warning');
      }
      this.form.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    // Siempre enviar fecha: si está vacía, enviar cadena vacía para indicar que se debe eliminar
    const rawFecha = this.form.get('fecha')?.value;
    const fechaValue = rawFecha ? rawFecha.toString().trim() : '';
    // Siempre enviar el campo fecha, incluso si está vacío (para poder eliminar la fecha)
    formData.append('fecha', fechaValue);

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value;
    const processedDescription = description
      .split('\n')
      .map((line: string) => line.trimEnd())
      .join('\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    formData.append('description', processedDescription);

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
          'notifications.news.success.updated'
        );
        this.notificationSrv.addNotification(message, 'success');
        this.submitSuccess.emit();
        this.loadExistingNews();

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
            'notifications.news.error.duplicateImage'
          );
          this.notificationSrv.addNotification(message, 'error');
        } else {
          const message = this.transloco.translate(
            'notifications.news.error.update'
          );
          this.notificationSrv.addNotification(message, 'error');
        }
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid || this.uploading;
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
    // Limpiar URLs de objetos
    if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imageUrl);
    }
    if (this.videoUrl) {
      const unsafeUrl = this.videoUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }
  }
}
