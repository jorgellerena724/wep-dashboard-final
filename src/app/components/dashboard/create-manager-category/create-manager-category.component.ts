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
import { ManagerCategoryService } from '../../../shared/services/features/manager-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HomeData } from '../../../shared/interfaces/home.interface';

@Component({
  selector: 'app-create-manager-category',
  templateUrl: './create-manager-category.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
})
export class CreateManagerCategoryComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;
  existingCategories: HomeData[] = [];

  constructor(
    private fb: FormBuilder,
    private srv: ManagerCategoryService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      title: [
        '',
        [Validators.required, Validators.minLength(3)],
        [this.duplicateNameValidator.bind(this)],
      ],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    this.loadExistingCategories();
    if (this.initialData) {
      this.form.patchValue(this.initialData);
      this.id = this.initialData.id || 0;
    }
  }

  loadExistingCategories(): void {
    this.srv.get().subscribe({
      next: (categories) => {
        this.existingCategories = categories || [];
        // Actualizar validación después de cargar categorías
        const titleControl = this.form.get('title');
        if (titleControl && titleControl.value) {
          titleControl.updateValueAndValidity();
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      },
    });
  }

  duplicateNameValidator(
    control: AbstractControl
  ): Promise<ValidationErrors | null> {
    return new Promise((resolve) => {
      const title = control.value?.trim().toLowerCase();
      if (!title) {
        resolve(null);
        return;
      }

      const isDuplicate = this.existingCategories.some(
        (category) =>
          category.title?.trim().toLowerCase() === title &&
          category.id !== this.id
      );

      if (isDuplicate) {
        resolve({ duplicateName: true });
      } else {
        resolve(null);
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      if (this.form.get('title')?.errors?.['duplicateName']) {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.manager-category.error.duplicateName'
          ),
          'warning'
        );
      } else {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.manager-category.error.formInvalid'
          ),
          'warning'
        );
      }
      this.form.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.get('title')?.value);

    this.srv.post(formData).subscribe({
      next: (response) => {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.manager-category.success.created'
          ),
          'success'
        );
        this.submitSuccess.emit();
        this.loadExistingCategories();

        if (this.initialData?.onSave) {
          this.initialData.onSave();
        }

        if (!this.initialData?.closeOnSubmit) {
          this.form.reset();
        }
      },
      error: (error) => {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.manager-category.error.create'
          ),
          'error'
        );
        console.error('Error:', error);
      },
    });
  }

  get isFormInvalid(): boolean {
    return this.form.invalid;
  }
}
