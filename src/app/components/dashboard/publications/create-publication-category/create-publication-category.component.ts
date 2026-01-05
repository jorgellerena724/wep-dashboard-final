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
  FormControl,
} from '@angular/forms';

import { DynamicComponent } from '../../../../shared/interfaces/dynamic.interface';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';
import { NotificationService } from '../../../../shared/services/system/notification.service';
import { PublicationCategoryService } from '../../../../shared/services/features/publication-category.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HomeData } from '../../../../shared/interfaces/home.interface';

@Component({
  selector: 'app-create-publication-category',
  templateUrl: './create-publication-category.component.html',
  standalone: true,
  imports: [ReactiveFormsModule, TextFieldComponent, TranslocoModule],
})
export class CreatePublicationCategoryComponent implements DynamicComponent {
  private transloco = inject(TranslocoService);
  @Input() initialData?: any;
  @Output() formValid = new EventEmitter<boolean>();
  @Output() submitSuccess = new EventEmitter<void>();
  id: number;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private srv: PublicationCategoryService,
    private notificationSrv: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
    });

    this.id = 0;

    this.form.statusChanges.subscribe(() => {
      this.formValid.emit(this.form.valid);
    });
  }

  ngOnInit() {
    if (this.initialData) {
      this.form.patchValue(this.initialData);
      this.id = this.initialData.id || 0;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      if (this.form.get('title')?.errors?.['duplicateName']) {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.publication-category.error.duplicateName'
          ),
          'warning'
        );
      } else {
        this.notificationSrv.addNotification(
          this.transloco.translate(
            'notifications.publication-category.error.formInvalid'
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
            'notifications.publication-category.success.created'
          ),
          'success'
        );
        this.submitSuccess.emit();

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
            'notifications.publication-category.error.create'
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

  getFormControl(controlName: string): FormControl {
    return this.form.get(controlName) as FormControl;
  }
}
