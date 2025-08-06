import {
  Injectable,
  ComponentRef,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
} from '@angular/core';
import { ConfirmDialogComponent } from '../../components/app-confirm-dialog/app-confirm-dialog.component';

export interface ConfirmConfig {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private dialogRef: ComponentRef<ConfirmDialogComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector,
  ) {}

  async confirm(config: ConfirmConfig): Promise<boolean> {
    // Si ya existe un diálogo, destruirlo
    if (this.dialogRef) {
      this.dialogRef.destroy();
      this.dialogRef = null;
    }

    // Crear el componente dinámicamente
    this.dialogRef = createComponent(ConfirmDialogComponent, {
      environmentInjector: this.injector,
    });

    // Configurar el componente
    const instance = this.dialogRef.instance;
    instance.title = config.title ?? 'Confirmar acción';
    instance.message = config.message;
    instance.confirmLabel = config.confirmLabel ?? 'Confirmar';
    instance.cancelLabel = config.cancelLabel ?? 'Cancelar';

    // Adjuntar al DOM
    document.body.appendChild(this.dialogRef.location.nativeElement);
    this.appRef.attachView(this.dialogRef.hostView);

    try {
      // Mostrar el diálogo y esperar la respuesta
      const result = await instance.show();
      return result;
    } finally {
      // Limpiar
      this.appRef.detachView(this.dialogRef.hostView);
      this.dialogRef.destroy();
      this.dialogRef = null;
    }
  }
}
