import { Injectable, ComponentRef, Type } from '@angular/core';
import { Subject } from 'rxjs';

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
  private modalConfig = new Subject<ModalConfig>();
  private closeSubject = new Subject<void>();
  modalConfig$ = this.modalConfig.asObservable();
  close$ = this.closeSubject.asObservable();

  open(config: ModalConfig) {
    this.modalConfig.next(config);
  }

  close() {
    this.closeSubject.next(); // Emitir un evento para cerrar el modal
  }
}
