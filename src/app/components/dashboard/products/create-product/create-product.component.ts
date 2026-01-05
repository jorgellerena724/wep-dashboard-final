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
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  FormControl,
  AbstractControl,
  ValidationErrors,
  AsyncValidatorFn,
} from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../../shared/interfaces/fileUpload.interface';
import { CategoryService } from '../../../../shared/services/features/category.service';
import { SelectComponent } from '../../../../shared/components/app-select/app-select.component';
import { ProductService } from '../../../../shared/services/features/product.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TooltipModule } from 'primeng/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface ProductVariant {
  description: string;
  price: number;
}

interface ProductFile {
  file: File | null;
  title: string;
  previewUrl: string | null;
  videoUrl: SafeResourceUrl | null;
  isVideo: boolean;
}

@Component({
  selector: 'app-create-product',
  templateUrl: './create-product.component.html',
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
export class CreateProductComponent implements DynamicComponent {
  // Servicios
  private fb = inject(FormBuilder);
  private srv = inject(ProductService);
  private notificationSrv = inject(NotificationService);
  private categorySrv = inject(CategoryService);
  private transloco = inject(TranslocoService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  // Signals para inputs/outputs
  initialData = input<any>();
  formValid = output<boolean>();
  submitSuccess = output<void>();
  submitError = output<void>();

  // Signals para estado
  id = signal<number>(0);
  uploading = signal<boolean>(false);
  showCalUrlField = signal<boolean>(false);
  categories = signal<any[]>([]);

  // Signals para archivos múltiples
  productFiles = signal<ProductFile[]>([]);

  // Signals para variantes
  variants = signal<ProductVariant[]>([]);

  // Form Arrays
  filesFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);
  variantsFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  // Formulario
  form: FormGroup;

  // Computed para facilitar acceso en template
  isFormInvalidComputed = signal<boolean>(false);

  constructor() {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      cal_url: [''],
      category: ['', Validators.required],
      description: [''],
      files: this.filesFormArray,
      variants: this.variantsFormArray,
    });

    this.filesFormArray.setErrors({ required: true });

    // Effect para inicializar datos
    effect(() => {
      const data = this.initialData();
      if (data) {
        untracked(() => {
          this.form.patchValue(data);

          if (data.variants && typeof data.variants === 'object') {
            this.loadVariantsFromData(data.variants);
          }
        });
      }
    });

    // Effect para inicializar
    effect(() => {
      this.initShowCalUrlField();
      this.fetchCategories();
    });

    // Effect para actualizar isFormInvalidComputed
    effect(() => {
      const invalid =
        this.form.invalid ||
        this.uploading() ||
        this.productFiles().length === 0;
      this.isFormInvalidComputed.set(invalid);
    });

    // Suscripción a cambios del formulario
    this.form.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValid.emit(this.form.valid);
      });
  }

  // Métodos para manejar archivos múltiples
  onFileUploaded(files: FileList | File[]): void {
    const filesArray = files instanceof FileList ? Array.from(files) : files;

    filesArray.forEach((file) => {
      const supportedVideoTypes = ['video/mp4', 'video/quicktime'];
      const isVideo = supportedVideoTypes.includes(file.type);

      if (isVideo) {
        const videoObjectUrl = URL.createObjectURL(file);
        const videoUrl =
          this.sanitizer.bypassSecurityTrustResourceUrl(videoObjectUrl);

        const productFile: ProductFile = {
          file,
          title: '',
          previewUrl: null,
          videoUrl,
          isVideo,
        };

        this.productFiles.update((files) => [...files, productFile]);
        this.addFileToFormArray(productFile);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const previewUrl = reader.result as string;

          const productFile: ProductFile = {
            file,
            title: '',
            previewUrl,
            videoUrl: null,
            isVideo: false,
          };

          this.productFiles.update((files) => [...files, productFile]);
          this.addFileToFormArray(productFile);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  private addFileToFormArray(productFile: ProductFile): void {
    const fileGroup = this.fb.group({
      title: [productFile.title],
      file: [productFile.file],
    });
    this.filesFormArray.push(fileGroup);

    // Limpiar el error de required cuando hay al menos un archivo
    if (this.filesFormArray.length > 0) {
      this.filesFormArray.setErrors(null);
    }
  }

  removeFile(index: number): void {
    const currentFiles = this.productFiles();
    const fileToRemove = currentFiles[index];

    // Limpiar URLs
    if (
      fileToRemove.previewUrl &&
      fileToRemove.previewUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    if (fileToRemove.videoUrl) {
      const unsafeUrl = fileToRemove.videoUrl as any;
      if (unsafeUrl.changingThisBreaksApplicationSecurity) {
        URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
      }
    }

    // Remover de arrays
    this.productFiles.update((files) => {
      const newFiles = [...files];
      newFiles.splice(index, 1);
      return newFiles;
    });
    this.filesFormArray.removeAt(index);

    // Marcar como requerido si no quedan archivos
    if (this.productFiles().length === 0) {
      this.filesFormArray.setErrors({ required: true });
      this.filesFormArray.markAsTouched();
    }
  }

  // Métodos para reordenar archivos
  moveFileUp(index: number): void {
    if (index === 0) return;

    this.productFiles.update((files) => {
      const newFiles = [...files];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index - 1];
      newFiles[index - 1] = temp;
      return newFiles;
    });

    // Intercambiar en filesFormArray
    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index - 1, control);
  }

  moveFileDown(index: number): void {
    const currentFiles = this.productFiles();
    if (index === currentFiles.length - 1) return;

    this.productFiles.update((files) => {
      const newFiles = [...files];
      const temp = newFiles[index];
      newFiles[index] = newFiles[index + 1];
      newFiles[index + 1] = temp;
      return newFiles;
    });

    // Intercambiar en filesFormArray
    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index + 1, control);
  }

  getFileControl(index: number, field: string): FormControl {
    const fileGroup = this.filesFormArray.at(index) as FormGroup;
    return fileGroup.get(field) as FormControl;
  }

  // Métodos para variantes
  addVariant(): void {
    const variantGroup = this.fb.group({
      description: ['', Validators.required],
      price: ['', Validators.min(0)],
    });

    this.variantsFormArray.push(variantGroup);
    this.variants.update((variants) => [
      ...variants,
      { description: '', price: 0 },
    ]);
  }

  removeVariant(index: number): void {
    this.variantsFormArray.removeAt(index);
    this.variants.update((variants) => {
      const newVariants = [...variants];
      newVariants.splice(index, 1);
      return newVariants;
    });
  }

  getVariantControl(index: number, field: string): FormControl {
    const variantGroup = this.variantsFormArray.at(index) as FormGroup;
    return variantGroup.get(field) as FormControl;
  }

  private loadVariantsFromData(variantsData: any): void {
    if (Array.isArray(variantsData)) {
      this.variants.set([]);
      this.variantsFormArray.clear();

      const newVariants: ProductVariant[] = [];

      variantsData.forEach((variant: any) => {
        const variantGroup = this.fb.group({
          description: [variant.description || '', Validators.required],
          price: [variant.price || 0, Validators.min(0)],
        });

        this.variantsFormArray.push(variantGroup);
        newVariants.push({
          description: variant.description || '',
          price: variant.price || 0,
        });
      });

      this.variants.set(newVariants);
    }
  }

  private getVariantsData(): ProductVariant[] {
    const variantsData: ProductVariant[] = [];
    for (let i = 0; i < this.variantsFormArray.length; i++) {
      const variantGroup = this.variantsFormArray.at(i) as FormGroup;
      variantsData.push({
        description: variantGroup.get('description')?.value,
        price: parseFloat(variantGroup.get('price')?.value),
      });
    }
    return variantsData;
  }

  async onSubmit(): Promise<void> {
    const currentFiles = this.productFiles();

    // Verificar que haya al menos un archivo
    if (this.form.invalid || currentFiles.length === 0) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      this.form.markAllAsTouched();

      this.filesFormArray.setErrors(
        currentFiles.length === 0 ? { required: true } : null
      );
      this.filesFormArray.markAsTouched();

      this.submitError.emit();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    const calUrlValue = this.form.get('cal_url')?.value;
    formData.append(
      'cal_url',
      calUrlValue && calUrlValue.trim() ? calUrlValue.trim() : ''
    );

    // Preservar saltos de línea en la descripción
    const description = this.form.get('description')?.value || '';
    const processedDescription = description
      ? description
          .split('\n')
          .map((line: string) => line.trimEnd())
          .join('\n')
          .replace(/^\s+/, '')
          .replace(/\s+$/, '')
      : '';
    formData.append('description', processedDescription);
    formData.append('category_id', this.form.get('category')?.value);

    // Agregar variants como JSON
    const variantsData = this.getVariantsData();
    formData.append('variants', JSON.stringify(variantsData));

    // Agregar títulos
    const fileTitles = this.filesFormArray.controls.map(
      (control) => control.get('title')?.value || ''
    );
    formData.append('file_titles', JSON.stringify(fileTitles));

    // Agregar archivos
    currentFiles.forEach((productFile) => {
      if (productFile.file) {
        formData.append('files', productFile.file, productFile.file.name);
      }
    });

    this.uploading.set(true);

    this.srv
      .post(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.uploading.set(false);
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.products.success.created'),
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
          this.notificationSrv.addNotification(
            this.transloco.translate('notifications.products.error.create'),
            'error'
          );
          this.submitError.emit();
        },
      });
  }

  get isFormInvalid(): boolean {
    return (
      this.form.invalid || this.uploading() || this.productFiles().length === 0
    );
  }

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }

  fetchCategories(): void {
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

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
  }

  onVideoLoaded(event: Event, videoPlayer: HTMLVideoElement): void {
    videoPlayer.muted = true;
    videoPlayer.playsInline = true;
    videoPlayer.play().catch(() => {});
  }

  private resetForm(): void {
    this.form.reset();

    // Limpiar URLs
    const currentFiles = this.productFiles();
    currentFiles.forEach((file) => {
      if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.previewUrl);
      }
      if (file.videoUrl) {
        const unsafeUrl = file.videoUrl as any;
        if (unsafeUrl.changingThisBreaksApplicationSecurity) {
          URL.revokeObjectURL(unsafeUrl.changingThisBreaksApplicationSecurity);
        }
      }
    });

    this.productFiles.set([]);
    this.filesFormArray.clear();
    this.filesFormArray.setErrors({ required: true });
    this.variants.set([]);
    this.variantsFormArray.clear();
  }

  private initShowCalUrlField(): void {
    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showCalUrlField.set(
        this.isClientAllowedForCalUrl(clientFromStorage)
      );
      return;
    }
    this.showCalUrlField.set(false);
  }

  private isClientAllowedForCalUrl(
    clientValue: string | undefined | null
  ): boolean {
    if (!clientValue && clientValue !== '') {
      return false;
    }
    return clientValue === 'shirkasoft' || clientValue === 'breeze';
  }

  private getClientFromLocalStorage(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const candidateKeys = [
      'session',
      'user',
      'userSession',
      'auth',
      'currentUser',
      'wep_session',
    ];

    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'client' in parsed) {
          return parsed['client'];
        }
        if (typeof parsed === 'string') {
          return parsed;
        }
      } catch (e) {
        if (typeof raw === 'string' && raw.trim().length > 0) {
          return raw;
        }
      }
    }

    const direct = localStorage.getItem('sessionClient');
    if (direct) return direct;

    return null;
  }
}
