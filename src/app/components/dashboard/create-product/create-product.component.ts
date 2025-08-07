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

// Interfaces para las variantes
interface ProductVariant {
  description: string;
  price: number;
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
  selectedFile: File | null = null;
  categories: any[] = [];
  uploading = false;
  loadingImage = false;
  imageUrl: string | null = null;
  isVideo: boolean = false;
  videoUrl: SafeResourceUrl | null = null;

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
      title: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      image: ['', Validators.required],
      price: [''],
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

      // Si hay variants en initialData, cargarlas
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

  // Métodos para manejar las variantes
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
    // Si variantsData es un array directo de variantes
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
    // Si variantsData es un objeto con estructura (para compatibilidad)
    else if (variantsData && typeof variantsData === 'object') {
      // Si tiene la estructura antigua con type y variants
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
    formData.append('category_id', this.form.get('category')?.value);
    formData.append('price', this.form.get('price')?.value);

    // Agregar variants como JSON
    const variantsData = this.getVariantsData();
    formData.append('variants', JSON.stringify(variantsData));

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
          'Producto registrado correctamente.',
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
          this.variants = [];
          this.variantsFormArray.clear();
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
            'Error al registrar el producto.',
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
            'Error al obtener las Categorías',
            'error'
          );
          reject(err);
        },
      });
    });
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
