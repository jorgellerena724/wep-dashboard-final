import {
  Component,
  viewChild,
  ViewContainerRef,
  ComponentRef,
  inject,
  effect,
  ChangeDetectionStrategy,
  signal,
  DestroyRef,
  computed,
  untracked,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ModalService, ModalConfig } from '../../services/system/modal.service';
import { DynamicComponent } from '../../interfaces/dynamic.interface';
import { NotificationService } from '../../services/system/notification.service';
import { Subscription } from 'rxjs';
import { FormControl, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  templateUrl: './app-modal.component.html',
  standalone: true,
  imports: [DialogModule, ButtonModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  private notificationSrv = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  modalSrv = inject(ModalService);

  container = viewChild.required('dynamicContent', { read: ViewContainerRef });

  visible = signal(false);
  title = signal('');
  currentConfig = signal<ModalConfig | null>(null);
  componentRef: ComponentRef<any> | null = null;
  isFormValid = signal(false);
  isProcessing = signal(false);
  loading = signal(false);
  isExpanded = signal(false);

  private subscriptions: Subscription[] = [];

  modalButtonsVisible = computed(
    () => this.currentConfig()?.showButtons ?? true,
  );

  constructor() {
    effect(() => {
      const config = this.modalSrv.modalConfig();
      if (config) {
        this.title.set(config.title);
        this.currentConfig.set(config);
        untracked(() => this.loadComponent(config));
        this.visible.set(true);
        this.isProcessing.set(false);
        this.loading.set(false);
      } else {
        this.visible.set(false);
      }
    });

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private loadComponent(config: ModalConfig) {
    const containerRef = this.container();
    if (!containerRef) return;

    this.cleanup();
    containerRef.clear();

    this.componentRef = containerRef.createComponent(config.component);

    // Pasar datos de entrada
    if (config.data) {
      Object.entries(config.data).forEach(([key, value]) => {
        this.componentRef?.setInput(key, value);
      });
    }

    const instance = this.componentRef.instance;

    // Suscribirse a eventos
    this.subscribeToOutput(instance.formValid, (valid: boolean) =>
      this.isFormValid.set(valid),
    );
    this.subscribeToOutput(instance.submitSuccess, () =>
      this.handleSubmit(true),
    );
    this.subscribeToOutput(instance.submitError, () =>
      this.handleSubmit(false),
    );

    this.componentRef.changeDetectorRef.detectChanges();
  }

  private subscribeToOutput(output: any, callback: (value: any) => void) {
    if (output?.subscribe) {
      this.subscriptions.push(output.subscribe(callback));
    }
  }

  private handleSubmit(success: boolean) {
    this.isProcessing.set(false);
    this.loading.set(false);
    if (success) {
      untracked(() => this.modalSrv.accept());
    }
  }

  closeModal() {
    this.visible.set(false);
    this.isProcessing.set(false);
    this.loading.set(false);
    this.cleanup();
    this.modalSrv.clear();
  }

  toggleExpand() {
    this.isExpanded.update((expanded) => !expanded);
  }

  onAccept() {
    if (
      !this.componentRef ||
      !this.isDynamicComponent(this.componentRef.instance)
    ) {
      return;
    }

    if (this.isProcessing()) return;

    const instance = this.componentRef.instance;
    const form = this.getForm(instance);

    if (form) {
      this.markAllAsTouched(form);
      this.componentRef.changeDetectorRef.detectChanges();

      if (this.hasRealErrors(form)) {
        this.notificationSrv.addNotification(
          'Compruebe los campos del formulario.',
          'warning',
        );
        return;
      }
    }

    this.isProcessing.set(true);
    this.loading.set(true);
    instance.onSubmit();
  }

  private getForm(instance: any): FormGroup | null {
    if (!instance['form']) return null;
    return typeof instance['form'] === 'function'
      ? instance['form']()
      : instance['form'];
  }

  private hasRealErrors(control: FormGroup | FormControl): boolean {
    if (control instanceof FormControl) {
      const errors = control.errors;
      return errors
        ? Object.keys(errors).some((key) => key !== 'warning')
        : false;
    }

    // Verificar errores del grupo
    const groupErrors = control.errors;
    if (
      groupErrors &&
      Object.keys(groupErrors).some((key) => key !== 'warning')
    ) {
      return true;
    }

    // Verificar controles hijos
    return Object.values(control.controls).some((child) =>
      this.hasRealErrors(child as any),
    );
  }

  private markAllAsTouched(control: FormGroup | FormControl): void {
    control.markAsTouched();
    control.updateValueAndValidity({ onlySelf: true, emitEvent: true });

    if (control instanceof FormGroup) {
      Object.values(control.controls).forEach((child) =>
        this.markAllAsTouched(child as any),
      );
    }
  }

  private isDynamicComponent(instance: any): instance is DynamicComponent {
    return (
      typeof instance?.onSubmit === 'function' && instance?.form !== undefined
    );
  }

  private cleanup() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];

    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.visible()) {
      this.closeModal();
    }
  }
}
