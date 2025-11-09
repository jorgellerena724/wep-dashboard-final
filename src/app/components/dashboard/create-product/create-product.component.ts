import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  Inject,
  OnInit,
  PLATFORM_ID,
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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DynamicComponent } from '../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { AppFileUploadComponent } from '../../../shared/components/app-file-upload/app-file-upload.component';
import { FileUploadError } from '../../../shared/interfaces/fileUpload.interface';
import { CategoryService } from '../../../shared/services/features/category.service';
import { SelectComponent } from '../../../shared/components/app-select/app-select.component';
import { ProductService } from '../../../shared/services/features/product.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { TooltipModule } from 'primeng/tooltip';

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
    CommonModule,
    TextFieldComponent,
    AppFileUploadComponent,
    SelectComponent,
    TranslocoModule,
    TooltipModule,
  ],
})
export class CreateProductComponent implements DynamicComponent, OnInit {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  @Output() submitError = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  categories: any[] = [];
  products: any[] = [];
  uploading = false;
  showCalUrlField = false;

  // Propiedades para archivos múltiples
  productFiles: ProductFile[] = [];
  filesFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  // Propiedades para las variantes
  variants: ProductVariant[] = [];
  variantsFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);


  constructor(
    private fb: FormBuilder,
    private srv: ProductService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef,
    private categorySrv: CategoryService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.form = this.fb.group({
      title: [
        '',
        [Validators.required, Validators.minLength(2)],
        [this.uniqueTitleValidator()],
      ],
      cal_url: [''],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      files: this.filesFormArray,
      variants: this.variantsFormArray,
    });

    this.id = 0;

    // Marcar el FormArray de files como requerido desde el inicio
    this.filesFormArray.setErrors({ required: true });

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit(): Promise<void> {
    // Inicializar la visibilidad del campo cal_url
    this.initShowCalUrlField();

    if (this.initialData) {
      this.form.patchValue(this.initialData);

      if (
        this.initialData.variants &&
        typeof this.initialData.variants === 'object'
      ) {
        this.loadVariantsFromData(this.initialData.variants);
      }
    }

    const initTasks = [this.fetchCategories(), this.fetchProducts()];
    await Promise.all(initTasks);
  }

  // Métodos para manejar archivos múltiples
  onFileUploaded(files: FileList | File[]): void {
    // Convertir FileList a Array si es necesario
    const filesArray = files instanceof FileList ? Array.from(files) : files;

    filesArray.forEach((file) => {
      // Validar formato y tamaño según especificaciones: JPG, PNG, MP4, MOV. Tamaño máximo 20MB
      if (!this.validateFile(file)) {
        return; // Saltar este archivo si no es válido
      }

      const supportedVideoTypes = [
        'video/mp4',
        'video/quicktime', // MOV files
      ];

      const isVideo = supportedVideoTypes.includes(file.type);

      if (isVideo) {
        const videoObjectUrl = URL.createObjectURL(file);
        const videoUrl =
          this.sanitizer.bypassSecurityTrustResourceUrl(videoObjectUrl);

        const productFile: ProductFile = {
          file,
          title: '', // Títulos completamente opcionales ahora
          previewUrl: null,
          videoUrl,
          isVideo,
        };

        this.productFiles.push(productFile);
        this.addFileToFormArray(productFile);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const previewUrl = reader.result as string;

          const productFile: ProductFile = {
            file,
            title: '', // Títulos completamente opcionales ahora
            previewUrl,
            videoUrl: null,
            isVideo: false,
          };

          this.productFiles.push(productFile);
          this.addFileToFormArray(productFile);
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  private validateFile(file: File): boolean {
    // Tipos permitidos según especificaciones: JPG, PNG, MP4, MOV
    const allowedTypes = [
      'image/jpeg', // JPG
      'image/png', // PNG
      'video/mp4', // MP4
      'video/quicktime', // MOV
    ];

    // Tamaño máximo: 20MB
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB en bytes

    // Validar tipo de archivo
    if (!allowedTypes.includes(file.type)) {
      this.notificationSrv.addNotification(
        'Formato no permitido. Solo se permiten: JPG, PNG, MP4, MOV. Formato recibido: ' +
          file.type,
        'error'
      );
      return false;
    }

    // Validar tamaño
    if (file.size > MAX_SIZE) {
      const sizeInMB = Math.round((file.size / (1024 * 1024)) * 100) / 100;
      this.notificationSrv.addNotification(
        `Archivo demasiado grande. Tamaño máximo permitido: 20MB. Tamaño recibido: ${sizeInMB}MB`,
        'error'
      );
      return false;
    }

    return true;
  }

  private addFileToFormArray(productFile: ProductFile): void {
    // Títulos completamente opcionales - sin validadores
    const fileGroup = this.fb.group({
      title: [productFile.title], // Sin validadores
      file: [productFile.file],
    });
    this.filesFormArray.push(fileGroup);
    
    // Limpiar el error de required cuando hay al menos un archivo en el FormArray
    if (this.filesFormArray.length > 0) {
      this.filesFormArray.setErrors(null);
    }
  }

  removeFile(index: number): void {
    // Limpiar URLs
    const fileToRemove = this.productFiles[index];
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
    this.productFiles.splice(index, 1);
    this.filesFormArray.removeAt(index);
    
    // Marcar como requerido si no quedan archivos
    if (this.productFiles.length === 0) {
      this.filesFormArray.setErrors({ required: true });
      this.filesFormArray.markAsTouched();
    }
    
    this.cdr.detectChanges();
  }

  // Métodos para reordenar imágenes con flechas
  moveFileUp(index: number): void {
    if (index === 0) return; // Ya es la primera

    // Intercambiar en productFiles
    const temp = this.productFiles[index];
    this.productFiles[index] = this.productFiles[index - 1];
    this.productFiles[index - 1] = temp;

    // Intercambiar en filesFormArray
    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index - 1, control);

    this.cdr.detectChanges();
  }

  moveFileDown(index: number): void {
    if (index === this.productFiles.length - 1) return; // Ya es la última

    // Intercambiar en productFiles
    const temp = this.productFiles[index];
    this.productFiles[index] = this.productFiles[index + 1];
    this.productFiles[index + 1] = temp;

    // Intercambiar en filesFormArray
    const control = this.filesFormArray.at(index);
    this.filesFormArray.removeAt(index);
    this.filesFormArray.insert(index + 1, control);

    this.cdr.detectChanges();
  }

  getFileControl(index: number, field: string): FormControl {
    const fileGroup = this.filesFormArray.at(index) as FormGroup;
    return fileGroup.get(field) as FormControl;
  }

  // Métodos para variantes (sin cambios)
  addVariant(): void {
    const variantGroup = this.fb.group({
      description: ['', Validators.required],
      price: ['', Validators.min(0)], // Price ahora es opcional
    });

    this.variantsFormArray.push(variantGroup);
    this.variants.push({ description: '', price: 0 });
    this.cdr.detectChanges();
  }

  removeVariant(index: number): void {
    this.variantsFormArray.removeAt(index);
    this.variants.splice(index, 1);
    this.cdr.detectChanges();
  }

  getVariantControl(index: number, field: string): FormControl {
    const variantGroup = this.variantsFormArray.at(index) as FormGroup;
    return variantGroup.get(field) as FormControl;
  }

  private loadVariantsFromData(variantsData: any): void {
    if (Array.isArray(variantsData)) {
      this.variants = [];
      this.variantsFormArray.clear();

      variantsData.forEach((variant: any) => {
        const variantGroup = this.fb.group({
          description: [variant.description || '', Validators.required],
          price: [variant.price || 0, Validators.min(0)], // Price ahora es opcional
        });

        this.variantsFormArray.push(variantGroup);
        this.variants.push({
          description: variant.description || '',
          price: variant.price || 0,
        });
      });
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
    // Verificar que haya al menos un archivo
    if (this.form.invalid || this.productFiles.length === 0) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      this.form.markAllAsTouched();

      // Marcar el FormArray de files como touched para mostrar el error
      this.filesFormArray.setErrors(
        this.productFiles.length === 0 ? { required: true } : null
      );
      this.filesFormArray.markAsTouched();

      // Emitir error para que el modal resetee el estado de loading
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
    const description = this.form.get('description')?.value;
    const processedDescription = description
      .split('\n')
      .map((line: string) => line.trimEnd())
      .join('\n')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '');
    formData.append('description', processedDescription);
    formData.append('category_id', this.form.get('category')?.value);

    // Agregar variants como JSON
    const variantsData = this.getVariantsData();
    formData.append('variants', JSON.stringify(variantsData));

    // Agregar títulos (ahora completamente opcionales)
    const fileTitles = this.filesFormArray.controls.map(
      (control) => control.get('title')?.value || '' // Enviar string vacío si no hay título
    );
    formData.append('file_titles', JSON.stringify(fileTitles));

    // Agregar archivos
    this.productFiles.forEach((productFile) => {
      if (productFile.file) {
        formData.append('files', productFile.file, productFile.file.name);
      }
    });

    this.uploading = true;

    this.srv.post(formData).subscribe({
      next: (response) => {
        this.uploading = false;
        this.notificationSrv.addNotification(
          this.transloco.translate('notifications.products.success.created'),
          'success'
        );
        this.submitSuccess.emit();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }

        if (!this.initialData?.closeOnSubmit) {
          this.resetForm();
        }
      },
      error: (error) => {
        this.uploading = false;
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
      this.form.invalid || this.uploading || this.productFiles.length === 0
    );
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

  fetchProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.srv.get().subscribe({
        next: (data) => {
          this.products = data || [];
          resolve();
        },
        error: (err) => {
          // Silently fail - validation will work without preloaded data
          this.products = [];
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
        map((products: any[]) => {
          const exists = products.some(
            (product: any) => product.title?.trim().toLowerCase() === title
          );
          return exists ? { duplicateTitle: true } : null;
        }),
        catchError(() => {
          // Fallback to local products array if API call fails
          const exists = this.products.some(
            (product: any) => product.title?.trim().toLowerCase() === title
          );
          return of(exists ? { duplicateTitle: true } : null);
        })
      );
    };
  }

  onFileError(error: FileUploadError): void {
    this.notificationSrv.addNotification(error.message, 'error');
  }

  ngOnDestroy() {
    // Limpiar todas las URLs de objetos
    this.productFiles.forEach((file) => {
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
  }

  onVideoLoaded(event: Event, videoPlayer: HTMLVideoElement): void {
    // Configurar el video para que se reproduzca mejor
    videoPlayer.muted = true;
    videoPlayer.playsInline = true;

    // Intentar reproducir automáticamente (silenciado)
    videoPlayer.play().catch(() => {
      // Ignorar errores de autoplay
    });
  }

  private resetForm(): void {
    this.form.reset();
    // Limpiar URLs
    this.productFiles.forEach((file) => {
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
    this.productFiles = [];
    this.filesFormArray.clear();
    // Marcar como requerido después de limpiar
    this.filesFormArray.setErrors({ required: true });
    this.variants = [];
    this.variantsFormArray.clear();
  }

  private initShowCalUrlField(): void {
    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showCalUrlField = this.isClientAllowedForCalUrl(clientFromStorage);
      return;
    }
    this.showCalUrlField = false;
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
