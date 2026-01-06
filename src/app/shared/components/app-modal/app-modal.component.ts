import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  inject,
  effect,
  ChangeDetectionStrategy,
  signal,
  DestroyRef,
  computed,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ModalService, ModalConfig } from '../../services/system/modal.service';
import { NotificationService } from '../../services/system/notification.service';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  standalone: true,
  imports: [DialogModule, ButtonModule, CommonModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  // Servicios
  private transloco = inject(TranslocoService);
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  modalSrv = inject(ModalService);

  @ViewChild('dynamicContent', { read: ViewContainerRef })
  container!: ViewContainerRef;

  // Signals para estado
  visible = signal(false);
  title = signal('');
  currentConfig = signal<ModalConfig | null>(null);
  componentRef: ComponentRef<any> | null = null;

  isFormValid = signal(false);
  loading = signal(false);
  isProcessing = signal(false);

  // Computed para clases CSS
  modalButtonsVisible = computed(() => {
    const config = this.currentConfig();
    return config?.showButtons ?? true;
  });

  constructor() {
    // Effect para manejar cambios en la configuración del modal
    effect(() => {
      const config = this.modalSrv.modalConfig();
      if (config) {
        this.title.set(config.title);
        this.currentConfig.set(config);
        this.loadComponent(config);
        this.visible.set(true);
        this.isProcessing.set(false);
        this.loading.set(false);
      } else {
        this.visible.set(false);
      }
    });
  }

  private loadComponent(config: ModalConfig) {
    // Limpiar componente anterior
    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }

    this.container.clear();

    try {
      this.componentRef = this.container.createComponent(config.component);

      // Pasar datos de entrada al componente
      if (config.data) {
        Object.keys(config.data).forEach((key) => {
          this.componentRef?.setInput(key, config.data[key]);
        });
      }

      const instance = this.componentRef.instance;

      // Suscripciones a los outputs del componente hijo
      instance.formValid?.subscribe((valid: boolean) =>
        this.isFormValid.set(valid)
      );

      instance.submitSuccess?.subscribe(() => {
        this.handleSubmitSuccess();
      });

      instance.submitError?.subscribe(() => {
        this.handleSubmitError();
      });
    } catch (error) {
      console.error('Error al cargar el componente modal:', error);
      this.visible.set(false);
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

    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
  }

  onAccept() {
    if (this.isProcessing() || !this.componentRef) return;

    const instance = this.componentRef.instance;

    // Marcar todos los campos como tocados para mostrar errores
    instance.form?.markAllAsTouched();

    if (!instance.form?.valid) {
      const translated = this.transloco.translate(
        'notifications.products.error.formInvalid'
      );
      this.notificationSrv.addNotification(translated, 'warning');
      return;
    }

    this.isProcessing.set(true);
    this.loading.set(true);

    // Llamar al método onSubmit del componente hijo
    instance.onSubmit?.();
  }
}
