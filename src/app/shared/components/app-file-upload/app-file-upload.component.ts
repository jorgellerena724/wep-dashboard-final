// app-file-upload.component.ts
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
} from '@angular/core';

import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FileUploadError } from '../../interfaces/fileUpload.interface';

@Component({
  selector: 'app-file-upload',
  templateUrl: './app-file-upload.component.html',
  standalone: true,
  imports: [
    FileUploadModule,
    ImageModule,
    ButtonModule,
    TooltipModule
],
})
export class AppFileUploadComponent implements OnChanges {
  @Input() label: string = 'Cargar archivo';
  @Input() accept: string = 'image/*';
  @Input() maxFileSize: number = 2000000; // 2MB por defecto
  @Input() fileUploadText: string = 'Seleccionar archivo';
  @Input() fileRecommendation: string =
    'Formato recomendado: PNG o JPG, tamaño máximo 2MB';
  @Input() multiple: boolean = false; // Nueva propiedad para múltiples archivos
  @Input() allowedExtensions?: string[]; // Nueva propiedad para extensiones permitidas personalizadas

  @Output() fileSelected = new EventEmitter<File[]>(); // Ahora emite un array de archivos
  @Output() fileRemoved = new EventEmitter<void>();
  @Output() fileError = new EventEmitter<FileUploadError>();

  selectedFiles: File[] = []; // Cambiamos a array para soportar múltiples

  private readonly mimeTypeToExtensions: { [key: string]: string[] } = {
    'image/*': ['.jpg', '.jpeg', '.png', '.ico', '.webp'],
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
  };

  ngOnInit() {
    // Asegurarnos de que accept tiene un formato válido
    if (this.accept && !this.accept.includes('/') && this.accept !== '*') {
      if (this.accept === 'image') {
        this.accept = 'image/*';
      } else if (this.accept === 'video') {
        this.accept = 'video/*';
      } else if (this.accept === 'audio') {
        this.accept = 'audio/*';
      }
    }
  }

  ngOnChanges(changes: any) {
    this.selectedFiles = [];
  }

  // ✅ Cambiar de uploadHandler a onSelect
  onFileSelect(event: any): void {
    if (event.files && event.files.length > 0) {
      const files: File[] = event.files;

      // Validar cada archivo
      for (const file of files) {
        if (file.size > this.maxFileSize) {
          const formattedMaxSize = this.formatFileSize(this.maxFileSize);
          const formattedFileSize = this.formatFileSize(file.size);

          const error: FileUploadError = {
            type: 'size',
            message: `El archivo es demasiado grande (${formattedFileSize}). Tamaño máximo: ${formattedMaxSize}`,
            file: file,
          };

          this.fileError.emit(error);
          event.files = [];
          return;
        }

        if (!this.isFileTypeValid(file)) {
          const allowedExtensions = this.getAllowedExtensions();
          const error: FileUploadError = {
            type: 'type',
            message: `Tipo de archivo no válido. Extensiones permitidas: ${allowedExtensions.join(
              ', '
            )}`,
            file: file,
          };

          this.fileError.emit(error);
          event.files = [];
          return;
        }
      }

      this.selectedFiles = files;
      this.fileSelected.emit(files);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
      // Menor a 1 MB
      const kb = bytes / 1024;
      // Mostrar sin decimales si es entero, con 1 decimal si no
      return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(1)} KB`;
    } else {
      const mb = bytes / (1024 * 1024);
      return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
    }
  }

  private isFileTypeValid(file: File): boolean {
    // Si se especifican extensiones personalizadas, validar solo contra ellas
    if (this.allowedExtensions && this.allowedExtensions.length > 0) {
      const fileExtension = this.getFileExtension(file.name).toLowerCase();
      return this.allowedExtensions.includes(`.${fileExtension}`);
    }

    const acceptTypes = this.accept.split(',').map((t) => t.trim());
    const fileExtension = this.getFileExtension(file.name).toLowerCase();

    // Verificar si la extensión está permitida
    for (const type of acceptTypes) {
      const extensions = this.mimeTypeToExtensions[type] || [];
      if (extensions.includes(`.${fileExtension}`)) {
        return true;
      }
    }

    // Verificación adicional para tipos MIME
    return acceptTypes.some((type) => {
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return file.type.startsWith(`${category}/`);
      }
      return file.type === type;
    });
  }

  private getFileExtension(filename: string): string {
    return filename
      .slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2)
      .toLowerCase();
  }

  private getAllowedExtensions(): string[] {
    // Si se especifican extensiones personalizadas, usarlas
    if (this.allowedExtensions && this.allowedExtensions.length > 0) {
      return this.allowedExtensions;
    }

    const acceptTypes = this.accept.split(',').map((t) => t.trim());
    const extensions: string[] = [];

    for (const type of acceptTypes) {
      if (this.mimeTypeToExtensions[type]) {
        extensions.push(...this.mimeTypeToExtensions[type]);
      }
    }

    // Eliminar duplicados y devolver
    return [...new Set(extensions)];
  }

  removeFile(): void {
    this.selectedFiles = [];
    this.fileRemoved.emit();
  }

  onError(event: any): void {
    console.warn('Error en la carga del archivo:', event);
  }

  // ✅ Método adicional para limpiar archivos si es necesario
  onClear(event: any): void {
    console.log('Archivos limpiados:', event);
    this.selectedFiles = [];
  }
}
