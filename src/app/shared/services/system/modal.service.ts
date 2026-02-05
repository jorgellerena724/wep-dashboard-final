import { Injectable, Type, signal, computed } from '@angular/core';

export interface ModalConfig {
  title: string;
  component: Type<any>;
  data?: any;
  showButtons?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  width?: string;
  onClose?: () => void;
  onAccept?: () => void;
  maxContentHeight?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  // Estado principal usando Signals
  private configSignal = signal<ModalConfig | null>(null);
  private closeRequestSignal = signal<number>(0);

  // Signals públicas
  modalConfig = computed(() => this.configSignal());
  closeRequest = computed(() => this.closeRequestSignal());

  // Computed para tamaño del modal
  modalSizeClass = computed(() => {
    const config = this.configSignal();
    switch (config?.size) {
      case 'sm':
        return 'w-96';
      case 'md':
        return 'w-1/2';
      case 'lg':
        return 'w-3/4';
      case 'xl':
        return 'w-11/12';
      case 'full':
        return 'w-full h-full';
      default:
        return 'w-11/12 max-w-4xl';
    }
  });

  modalWidth = computed(() => {
    const config = this.configSignal();
    if (config?.width) {
      return config.width;
    }
    return '90vw';
  });

  open(config: ModalConfig) {
    this.configSignal.set(config);
  }

  close() {
    const config = this.configSignal();
    if (config?.onClose) {
      config.onClose();
    }
    this.configSignal.set(null);
    this.closeRequestSignal.update((v) => v + 1);
  }

  accept() {
    const config = this.configSignal();
    if (config?.onAccept) {
      config.onAccept();
    }
    this.close();
  }

  // Limpiar estado
  clear() {
    this.configSignal.set(null);
  }
}
