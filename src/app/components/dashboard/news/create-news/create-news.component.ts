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
import { NewsService } from '../../../../shared/services/features/news.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HomeData } from '../../../../shared/interfaces/home.interface';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-create-news',
  templateUrl: './create-news.component.html',
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
export class CreateNewsComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(NewsService);
  private notificationSrv = inject(NotificationService);
  private transloco = inject(TranslocoService);
  private sanitizer = inject(DomSanitizer);
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
  isVideo = signal<boolean>(false);
  videoUrl = signal<SafeResourceUrl | null>(null);
  existingNews = signal<HomeData[]>([]);

  // Formulario
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      fecha: [''],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: ['', Validators.required],
    });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);
          this.id.set(data.id || 0);
        });
      }
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

    // Determinar si es video
    const supportedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
    ];

    const isVideoFile = supportedVideoTypes.includes(file.type);
    this.isVideo.set(isVideoFile);

    if (isVideoFile) {
      // Crear URL segura para el video
      const videoUrl = URL.createObjectURL(file);
      this.videoUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl)
      );
      this.imageUrl.set(null);
    } else {
      // Para imágenes
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl.set(reader.result as string);
        this.videoUrl.set(null);
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile(): void {
    // Revocar URLs de objetos
    const imgUrl = this.imageUrl();
    const vidUrl = this.videoUrl();

    if (imgUrl && imgUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imgUrl);
    }

    if (vidUrl) {
      const unsafeUrl = vidUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }

    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.videoUrl.set(null);
    this.isVideo.set(false);
    this.form.get('image')?.setValue(null);
    this.form.markAllAsTouched();
    this.form.patchValue({ image: null });
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

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
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

    // Solo agregar fecha si tiene un valor válido
    const rawFecha = this.form.get('fecha')?.value;
    const fechaValue = rawFecha ? rawFecha.toString().trim() : '';
    if (fechaValue.length > 0) {
      formData.append('fecha', fechaValue);
    }

    const file = this.selectedFile();
    if (file) {
      formData.append('photo', file, file.name);
    }

    this.uploading.set(true);

    this.srv
      .post(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);

          const message = this.transloco.translate(
            'notifications.news.success.created'
          );
          this.notificationSrv.addNotification(message, 'success');
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
    let messageKey = 'notifications.news.error.create';

    if (
      error.status === 400 &&
      error.error.message?.includes(
        'La imagen que esta intentando subir ya se encuentra en el servidor'
      )
    ) {
      messageKey = 'notifications.news.error.duplicateImage';
    }

    this.notificationSrv.addNotification(
      this.transloco.translate(messageKey),
      'error'
    );
  }

  private resetForm(): void {
    this.form.reset();
    this.selectedFile.set(null);
    this.imageUrl.set(null);
    this.videoUrl.set(null);
    this.isVideo.set(false);
  }

  get isFormInvalid(): boolean {
    return this.form.invalid || this.uploading();
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');

    console.error('Error de validación de archivo', {
      type: error.type,
      message: error.message,
      fileName: error.file.name,
      fileSize: error.file.size,
      fileType: error.file.type,
    });

    this.selectedFile.set(null);
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
