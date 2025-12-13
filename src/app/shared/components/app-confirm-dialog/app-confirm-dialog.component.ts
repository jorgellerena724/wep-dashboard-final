import { Component, Input } from '@angular/core';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './app-confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  @Input() title: string = 'Confirmar acción';
  @Input() message: string = '¿Está seguro de realizar esta acción?';
  @Input() confirmLabel: string = 'Confirmar';
  @Input() cancelLabel: string = 'Cancelar';

  visible: boolean = false;
  private resolveRef: ((value: boolean) => void) | null = null;

  show(): Promise<boolean> {
    this.visible = true;
    return new Promise((resolve) => {
      this.resolveRef = resolve;
    });
  }

  onConfirm() {
    this.visible = false;
    if (this.resolveRef) {
      this.resolveRef(true);
      this.resolveRef = null;
    }
  }

  onCancel() {
    this.visible = false;
    if (this.resolveRef) {
      this.resolveRef(false);
      this.resolveRef = null;
    }
  }
}
