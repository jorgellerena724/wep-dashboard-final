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
  FormArray,
  FormControl,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  ],
})
export class CreateProductComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  categories: any[] = [];
  uploading = false;

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
    private sanitizer: DomSanitizer
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
    if (this.initialData) {
      this.form.patchValue(this.initialData);

      if (
        this.initialData.variants &&
        typeof this.initialData.variants === 'object'
      ) {
        this.loadVariantsFromData(this.initialData.variants);
      }
    }

    const initTasks = [this.fetchCategories()];
    await Promise.all(initTasks);
  }

  // Métodos para manejar archivos múltiples
  onFileUploaded(files: FileList | File[]): void {
    // Convertir FileList a Array si es necesario
    const filesArray = files instanceof FileList ? Array.from(files) : files;

    filesArray.forEach((file) => {
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

  private addFileToFormArray(productFile: ProductFile): void {
    // Títulos completamente opcionales - sin validadores
    const fileGroup = this.fb.group({
      title: [productFile.title], // Sin validadores
      file: [productFile.file],
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

      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);
    const calUrlValue = this.form.get('cal_url')?.value;
    formData.append(
      'cal_url',
      calUrlValue && calUrlValue.trim() ? calUrlValue.trim() : ''
    );
    formData.append('description', this.form.get('description')?.value);
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
    this.variants = [];
    this.variantsFormArray.clear();
  }
}
