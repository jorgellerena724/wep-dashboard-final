import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ModalService, ModalConfig } from '../../services/system/modal.service';
import { DynamicComponent } from '../../interfaces/dynamic.interface';
import { NotificationService } from '../../services/system/notification.service';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  standalone: true,
  imports: [DialogModule, ButtonModule, CommonModule, TranslocoModule],
})
export class ModalComponent implements OnDestroy {
  private transloco = inject(TranslocoService);
  
  @ViewChild('dynamicContent', { read: ViewContainerRef })
  container!: ViewContainerRef;
  
  visible = false;
  title = '';
  isFormValid = false;
  componentRef: ComponentRef<any> | null = null;
  loading = false;
  currentConfig: ModalConfig | null = null;
  isProcessing = false; // Nueva propiedad para controlar el estado de procesamiento

  constructor(
    private modalService: ModalService,
    private notificationSrv: NotificationService
  ) {
    this.modalService.close$.subscribe(() => {
      this.closeModal();
    });
  }

  ngAfterViewInit() {
    this.modalService.modalConfig$.subscribe((config) => {
      this.title = config.title;
      this.currentConfig = config;
      this.loadComponent(config);
      this.visible = true;
      this.isProcessing = false; // Resetear el estado al abrir un nuevo modal
    });
  }

  loadComponent(config: ModalConfig) {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
    this.container.clear();
    this.componentRef = this.container.createComponent(config.component);
    
    if (config.data) {
      for (const key in config.data) {
        if (config.data.hasOwnProperty(key)) {
          this.componentRef.instance[key] = config.data[key];
        }
      }
    }

    // Escuchar el estado del formulario
    if (this.componentRef.instance.formValid) {
      this.componentRef.instance.formValid.subscribe((isValid: boolean) => {
        this.isFormValid = isValid;
      });
    }

    // Escuchar el evento de éxito del formulario
    if (this.componentRef.instance.submitSuccess) {
      this.componentRef.instance.submitSuccess.subscribe(() => {
        this.isProcessing = false; // Resetear el estado cuando termine exitosamente
        this.closeModal(); // Cerrar el modal solo si el envío fue exitoso
      });
    }

    // Escuchar errores del formulario (opcional)
    if (this.componentRef.instance.submitError) {
      this.componentRef.instance.submitError.subscribe(() => {
        this.isProcessing = false; // Resetear el estado en caso de error
        this.loading = false;
      });
    }
  }

  closeModal() {
    this.visible = false;
    this.isProcessing = false; // Resetear el estado al cerrar
    this.loading = false;
    
    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
  }

  ngOnDestroy() {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }

  onAccept() {
    // Prevenir múltiples clics
    if (this.isProcessing) {
      return;
    }

    if (
      !this.componentRef ||
      !this.isDynamicComponent(this.componentRef.instance)
    ) {
      return;
    }

    // Marcar todos los campos como tocados
    this.componentRef.instance['form'].markAllAsTouched();
    
    // Verificar si el formulario es válido
    if (!this.componentRef.instance['form'].valid) {
      this.notificationSrv.addNotification(
        this.transloco.translate('notifications.products.error.formInvalid'),
        'warning'
      );
      return;
    }

    // Activar estados de carga y procesamiento
    this.isProcessing = true;
    this.loading = true;

    try {
      // Llamar al método onSubmit del componente dinámico
      this.componentRef.instance.onSubmit();
    } catch (error) {
      // En caso de error sincrónico, resetear los estados
      this.isProcessing = false;
      this.loading = false;
      console.error('Error en onSubmit:', error);
    }
  }

  private isDynamicComponent(instance: any): instance is DynamicComponent {
    return typeof instance?.onSubmit === 'function';
  }
}