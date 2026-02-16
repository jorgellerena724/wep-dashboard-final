import {
  Component,
  ViewContainerRef,
  ComponentRef,
  inject,
  effect,
  ChangeDetectionStrategy,
  signal,
  DestroyRef,
  computed,
  viewChild,
  untracked,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ModalService, ModalConfig } from '../../services/system/modal.service';
import { NotificationService } from '../../services/system/notification.service';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { DynamicComponent } from '../../interfaces/dynamic.interface';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  standalone: true,
  imports: [DialogModule, ButtonModule, CommonModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  // Servicios
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  modalSrv = inject(ModalService);

  // Usando viewChild signal - disponible después del render
  container = viewChild.required('dynamicContent', { read: ViewContainerRef });

  // Signals para estado
  visible = signal(false);
  title = signal('');
  currentConfig = signal<ModalConfig | null>(null);
  componentRef: ComponentRef<any> | null = null;

  isFormValid = signal(false);
  loading = signal(false);
  isProcessing = signal(false);

  // Signal para manejar tamaño maximo
  maxContentHeight = signal('300px');

  // Signal para estado expandido
  isExpanded = signal(false);

  // Suscripciones para manejo manual
  private formValidSub?: Subscription;
  private submitSuccessSub?: Subscription;
  private submitErrorSub?: Subscription;

  // Computed para clases CSS
  modalButtonsVisible = computed(() => {
    const config = this.currentConfig();
    return config?.showButtons ?? true;
  });

  modalWidth = computed(() => this.modalSrv.modalWidth());

  constructor() {
    // Effect para manejar cambios en la configuración del modal
    effect(() => {
      const config = this.modalSrv.modalConfig();
      if (config) {
        this.title.set(config.title);
        this.currentConfig.set(config);

        if (config.maxContentHeight) {
          this.maxContentHeight.set(config.maxContentHeight);
        } else {
          this.maxContentHeight.set('300px'); // valor por defecto
        }

        untracked(() => {
          this.loadComponent(config);
        });

        this.visible.set(true);
        this.isProcessing.set(false);
        this.loading.set(false);
      } else {
        this.visible.set(false);
      }
    });

    // Registrar limpieza en el DestroyRef (reemplaza ngOnDestroy)
    this.destroyRef.onDestroy(() => {
      this.clearSubscriptions();
      if (this.componentRef) {
        this.componentRef.destroy();
        this.componentRef = null;
      }
    });
  }

  private loadComponent(config: ModalConfig) {
    // Obtener el contenedor (ahora es un signal)
    const containerRef = this.container();

    if (!containerRef) {
      console.error('Contenedor no disponible');
      return;
    }

    // Limpiar componente anterior
    this.clearSubscriptions();

    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }

    containerRef.clear();

    try {
      this.componentRef = containerRef.createComponent(config.component);

      // Pasar datos de entrada al componente
      if (config.data) {
        Object.keys(config.data).forEach((key) => {
          this.componentRef?.setInput(key, config.data[key]);
        });
      }

      const instance = this.componentRef.instance;

      // Suscripciones a los outputs del componente hijo
      if (
        instance.formValid &&
        typeof instance.formValid.subscribe === 'function'
      ) {
        this.formValidSub = instance.formValid.subscribe((valid: boolean) => {
          this.isFormValid.set(valid);
        });
      }

      if (
        instance.submitSuccess &&
        typeof instance.submitSuccess.subscribe === 'function'
      ) {
        this.submitSuccessSub = instance.submitSuccess.subscribe(() => {
          this.handleSubmitSuccess();
        });
      }

      if (
        instance.submitError &&
        typeof instance.submitError.subscribe === 'function'
      ) {
        this.submitErrorSub = instance.submitError.subscribe(() => {
          this.handleSubmitError();
        });
      }

      // Forzar detección de cambios
      this.componentRef.changeDetectorRef.detectChanges();
    } catch (error) {
      console.error('Error al cargar el componente modal:', error);
      this.notificationSrv.addNotification(
        'Error al cargar el componente del modal',
        'error',
      );
      this.visible.set(false);
      this.clearSubscriptions();
    }
  }

  private handleSubmitSuccess() {
    this.isProcessing.set(false);
    this.loading.set(false);
    this.modalSrv.close();
  }

  private handleSubmitError() {
    this.isProcessing.set(false);
    this.loading.set(false);
  }

  closeModal() {
    this.visible.set(false);
    this.isProcessing.set(false);
    this.loading.set(false);
    this.isExpanded.set(false);

    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
  }

  toggleExpand() {
    this.isExpanded.update((expanded: boolean) => !expanded);
  }

  onAccept() {
    if (
      !this.componentRef ||
      !this.isDynamicComponent(this.componentRef.instance)
    ) {
      return;
    }

    // Prevenir múltiples envíos simultáneos
    if (this.isProcessing()) {
      return;
    }

    const instance = this.componentRef.instance;

    if (instance['form']) {
      this.markAllFieldsAsTouchedRecursive(instance['form']);

      this.componentRef.changeDetectorRef.detectChanges();

      if (!instance['form'].valid) {
        this.notificationSrv.addNotification(
          'Compruebe los campos del formulario.',
          'warning',
        );
        return;
      }
    }

    this.componentRef.changeDetectorRef.detectChanges();

    this.isProcessing.set(true);
    this.loading.set(true);

    try {
      // onSubmit internamente debe validar nuevamente y manejar errores
      instance.onSubmit();
    } catch (error) {
      console.error('Error en onSubmit:', error);
      this.handleSubmitError();
    } finally {
      // Se resetea cuando submitSuccess o submitError se emite
    }
  }

  private isDynamicComponent(instance: any): instance is DynamicComponent {
    return (
      typeof instance?.onSubmit === 'function' && instance?.form !== undefined
    );
  }

  private clearSubscriptions() {
    if (this.formValidSub) {
      this.formValidSub.unsubscribe();
      this.formValidSub = undefined;
    }
    if (this.submitSuccessSub) {
      this.submitSuccessSub.unsubscribe();
      this.submitSuccessSub = undefined;
    }
    if (this.submitErrorSub) {
      this.submitErrorSub.unsubscribe();
      this.submitErrorSub = undefined;
    }
  }

  private markAllFieldsAsTouchedRecursive(
    formGroup: FormGroup | FormControl,
  ): void {
    if (formGroup instanceof FormControl) {
      formGroup.markAsTouched();
      formGroup.updateValueAndValidity({ onlySelf: true, emitEvent: true });
      return;
    }

    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);

      if (control instanceof FormGroup) {
        // Recursivo para FormGroups anidados
        this.markAllFieldsAsTouchedRecursive(control);
      } else if (control instanceof FormControl) {
        control.markAsTouched();
        control.updateValueAndValidity({ onlySelf: true, emitEvent: true });
      }
    });

    // También marcar el FormGroup padre
    formGroup.markAsTouched();
    formGroup.updateValueAndValidity({ onlySelf: true, emitEvent: true });
  }

  // Método para manejar tecla Escape
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.visible()) {
      this.closeModal();
    }
  }
}
