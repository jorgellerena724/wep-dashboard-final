import { Component, input, signal, output, OnDestroy } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './app-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent implements OnDestroy {
  // Inputs usando signals
  title = input<string>('Confirmar acción');
  message = input<string>('¿Está seguro de realizar esta acción?');
  confirmLabel = input<string>('Confirmar');
  cancelLabel = input<string>('Cancelar');

  // Signals para estado
  visible = signal<boolean>(false);
  private resolveRef = signal<((value: boolean) => void) | null>(null);

  // Output para notificar cuando se cierra (opcional, para limpieza)
  closed = output<void>();

  show(): Promise<boolean> {
    this.visible.set(true);
    return new Promise((resolve) => {
      this.resolveRef.set(resolve);
    });
  }

  onConfirm() {
    this.visible.set(false);
    const resolve = this.resolveRef();
    if (resolve) {
      resolve(true);
      this.resolveRef.set(null);
    }
    this.closed.emit();
  }

  onCancel() {
    this.visible.set(false);
    const resolve = this.resolveRef();
    if (resolve) {
      resolve(false);
      this.resolveRef.set(null);
    }
    this.closed.emit();
  }

  ngOnDestroy() {
    // Asegurarse de limpiar la referencia a la promesa
    this.resolveRef.set(null);
  }
}
