import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  FormControl,
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
  isExisting?: boolean; // Para identificar archivos existentes
  existingPath?: string; // Ruta del archivo existente
}

@Component({
  selector: 'app-update-product',
  templateUrl: './update-product.component.html',
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
export class UpdateProductComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  categories: any[] = [];
  uploading = false;
  loadingImage = false;
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
      title: ['', [Validators.required, Validators.minLength(2)]],
      cal_url: [''],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      files: this.filesFormArray,
      variants: this.variantsFormArray,
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  async ngOnInit(): Promise<void> {
    // Inicializar la visibilidad del campo cal_url
    this.initShowCalUrlField();

    if (this.initialData) {
      this.form.patchValue(this.initialData);
      this.form.get('category')?.setValue(this.initialData.category.id);
      this.id = this.initialData.id;

      // Cargar variantes existentes
      if (this.initialData.variants) {
        this.loadVariantsFromData(this.initialData.variants);
      }

      // Cargar archivos existentes
      if (this.initialData.files && Array.isArray(this.initialData.files)) {
        this.loadExistingFiles(this.initialData.files);
      }
    }

    const initTasks = [this.fetchCategories()];
    await Promise.all(initTasks);
  }

  // Cargar archivos existentes desde los datos del producto
  private loadExistingFiles(filesData: any[]): void {
    filesData.forEach((fileData, index) => {
      const isVideo = this.isVideoFile(fileData.media);

      const productFile: ProductFile = {
        file: null,
        title: fileData.title || '',
        previewUrl: null,
        videoUrl: null,
        isVideo,
        isExisting: true,
        existingPath: fileData.media,
      };

      this.productFiles.push(productFile);
      this.addFileToFormArray(productFile.title, null, index);

      // Cargar preview del archivo existente
      this.loadExistingFilePreview(productFile, index);
    });
  }

  private loadExistingFilePreview(
    productFile: ProductFile,
    index: number
  ): void {
    if (productFile.existingPath) {
      this.loadingImage = true;

      this.srv.getImage(productFile.existingPath).subscribe({
        next: (blob: Blob) => {
          if (productFile.isVideo) {
            this.createVideoPreview(
              blob,
              productFile.existingPath?.split('.').pop(),
              index
            );
          } else {
            this.createImagePreview(blob, index);
          }
          this.loadingImage = false;
        },
        error: () => {
          // Fallback si no se puede cargar el blob
          if (productFile.isVideo) {
            this.setFallbackVideo(productFile.existingPath!, index);
          } else {
            this.setFallbackImage(productFile.existingPath!, index);
          }
          this.loadingImage = false;
        },
      });
    }
  }

  private isVideoFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov'].includes(extension || '');
  }

  // Métodos para manejar archivos múltiples (igual que en create)
  onFileUploaded(files: File[]): void {
    files.forEach((file) => {
      const supportedVideoTypes = [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
      ];

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
          isExisting: false,
        };

        this.productFiles.push(productFile);
        this.addFileToFormArray(
          productFile.title,
          file,
          this.productFiles.length - 1
        );
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
            isExisting: false,
          };

          this.productFiles.push(productFile);
          this.addFileToFormArray(
            productFile.title,
            file,
            this.productFiles.length - 1
          );
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  private addFileToFormArray(
    title: string,
    file: File | null,
    index: number
  ): void {
    // Solo el primer archivo es requerido, los demás son opcionales
    const isFirstFile = index === 0;
    const validators = isFirstFile ? [Validators.required] : [];

    const fileGroup = this.fb.group({
      title: [title, validators],
      file: [file],
    });
    this.filesFormArray.push(fileGroup);
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

    // Si removimos el primer archivo, actualizar validadores del nuevo primer archivo
    if (this.productFiles.length > 0 && index === 0) {
      const newFirstFileGroup = this.filesFormArray.at(0) as FormGroup;
      newFirstFileGroup.get('title')?.setValidators([Validators.required]);
      newFirstFileGroup.get('title')?.updateValueAndValidity();
    }

    this.cdr.detectChanges();
  }

  getFileControl(index: number, field: string): FormControl {
    const fileGroup = this.filesFormArray.at(index) as FormGroup;
    return fileGroup.get(field) as FormControl;
  }

  isTitleRequired(index: number): boolean {
    return index === 0;
  }

  // Métodos para variantes (sin cambios)
  addVariant(): void {
    const variantGroup = this.fb.group({
      description: ['', Validators.required],
      price: ['', [Validators.required, Validators.min(0)]],
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
          price: [variant.price || 0, [Validators.required, Validators.min(0)]],
        });

        this.variantsFormArray.push(variantGroup);
        this.variants.push({
          description: variant.description || '',
          price: variant.price || 0,
        });
      });
    } else if (variantsData && typeof variantsData === 'object') {
      const variantsArray = variantsData.variants || [];
      if (Array.isArray(variantsArray)) {
        this.variants = [];
        this.variantsFormArray.clear();

        variantsArray.forEach((variant: any) => {
          const variantGroup = this.fb.group({
            description: [
              variant.value || variant.description || '',
              Validators.required,
            ],
            price: [
              variant.price || 0,
              [Validators.required, Validators.min(0)],
            ],
          });

          this.variantsFormArray.push(variantGroup);
          this.variants.push({
            description: variant.value || variant.description || '',
            price: variant.price || 0,
          });
        });
      }
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

  // Métodos para preview de archivos existentes
  private createVideoPreview(
    blob: Blob,
    extension: string | undefined,
    index: number
  ): void {
    let mimeType = 'video/mp4';
    if (extension === 'mov') mimeType = 'video/quicktime';
    if (extension === 'webm') mimeType = 'video/webm';
    if (extension === 'ogg') mimeType = 'video/ogg';

    const videoBlob = new Blob([blob], { type: mimeType });
    this.productFiles[index].videoUrl =
      this.sanitizer.bypassSecurityTrustResourceUrl(
        URL.createObjectURL(videoBlob)
      );
    this.cdr.detectChanges();
  }

  private setFallbackVideo(videoPath: string, index: number): void {
    this.productFiles[index].videoUrl =
      this.sanitizer.bypassSecurityTrustResourceUrl(videoPath);
    this.cdr.detectChanges();
  }

  private createImagePreview(blob: Blob, index: number): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.productFiles[index].previewUrl = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(new Blob([blob]));
  }

  private setFallbackImage(imagePath: string, index: number): void {
    this.productFiles[index].previewUrl = imagePath;
    this.cdr.detectChanges();
  }

  async onSubmit(): Promise<void> {
    // Verificar que haya al menos un archivo
    if (this.form.invalid || this.productFiles.length === 0) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      this.form.markAllAsTouched();

      this.filesFormArray.setErrors(
        this.productFiles.length === 0 ? { required: true } : null
      );
      this.filesFormArray.markAsTouched();

      return;
    }

    // Verificar que el primer archivo tenga título
    const firstFileTitle = this.getFileControl(0, 'title')?.value;
    if (!firstFileTitle?.trim()) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      this.getFileControl(0, 'title')?.markAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);
    formData.append('cal_url', this.form.get('cal_url')?.value);
    formData.append('description', this.form.get('description')?.value);
    formData.append('category_id', this.form.get('category')?.value);

    // Agregar variants como JSON
    const variantsData = this.getVariantsData();
    formData.append('variants', JSON.stringify(variantsData));

    // Agregar títulos de archivos (todos los archivos, existentes y nuevos)
    const fileTitles = this.filesFormArray.controls.map(
      (control) => control.get('title')?.value
    );
    formData.append('file_titles', JSON.stringify(fileTitles));

    // Agregar SOLO archivos nuevos (no los existentes)
    const newFiles = this.productFiles.filter(
      (file) => !file.isExisting && file.file
    );
    newFiles.forEach((productFile) => {
      if (productFile.file) {
        formData.append('files', productFile.file, productFile.file.name);
      }
    });

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

        if (!this.initialData?.closeOnSubmit) {
          this.resetForm();
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

  private resetForm(): void {
    // En update, no reseteamos completamente el formulario
    // Solo limpiamos los archivos nuevos y mantenemos los datos cargados
    const newFiles = this.productFiles.filter((file) => !file.isExisting);

    // Limpiar URLs de archivos nuevos
    newFiles.forEach((file) => {
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

    // Mantener solo los archivos existentes
    this.productFiles = this.productFiles.filter((file) => file.isExisting);

    // Reconstruir el FormArray con solo archivos existentes
    this.filesFormArray.clear();
    this.productFiles.forEach((file, index) => {
      this.addFileToFormArray(file.title, null, index);
    });

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
