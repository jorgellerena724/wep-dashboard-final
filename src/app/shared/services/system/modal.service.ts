import { Injectable, Type, signal, computed } from '@angular/core';

export interface ModalConfig {
  title: string;
  component: Type<any>;
  data?: any;
  showButtons?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  // Estado principal usando Signals
  private configSignal = signal<ModalConfig | null>(null);
  private closeRequestSignal = signal<number>(0); // Contador para disparar cierres

  // Exposición pública
  modalConfig = computed(() => this.configSignal());
  closeRequest = computed(() => this.closeRequestSignal());

  open(config: ModalConfig) {
    this.configSignal.set(config);
  }

  close() {
    this.configSignal.set(null);
    this.closeRequestSignal.update((v) => v + 1);
  }
}
