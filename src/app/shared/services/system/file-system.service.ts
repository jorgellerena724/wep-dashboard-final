// file-system.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import * as fs from 'fs';
import * as path from 'path';

@Injectable({
  providedIn: 'root',
})
export class FileSystemService {
  /**
   * Guarda un archivo en el sistema de archivos local
   * @param file Archivo a guardar
   * @param folder Carpeta destino dentro de uploads (ej: 'header')
   * @returns Promise con la ruta relativa del archivo guardado
   */
  async saveFile(file: File, folder: string): Promise<string> {
    try {
      // Crear directorio si no existe
      const uploadDir = path.join(environment.uploadsPath, folder);
      this.ensureDirectoryExists(uploadDir);

      // Generar nombre de archivo único manteniendo la extensión original
      const fileExt = path.extname(file.name);
      const baseName = path.basename(file.name, fileExt);
      const fileName = `${baseName}-${Date.now()}${fileExt}`;

      // Ruta completa del archivo
      const filePath = path.join(uploadDir, fileName);

      // Convertir el File a un ArrayBuffer y luego a un Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Escribir el archivo
      fs.writeFileSync(filePath, buffer);

      // Devolver la ruta relativa que se guardará en la base de datos
      return `/${path
        .relative(environment.uploadsPath, filePath)
        .split(path.sep)
        .join('/')}`;
    } catch (error) {
      console.error('Error al guardar el archivo:', error);
      throw new Error('No se pudo guardar el archivo');
    }
  }

  /**
   * Elimina un archivo del sistema de archivos
   * @param filePath Ruta relativa del archivo (desde uploads)
   * @returns Promise Indica si se eliminó correctamente
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      // Verificar que la ruta no esté vacía
      if (!filePath) {
        console.warn('Se intentó eliminar una ruta vacía');
        return false;
      }

      // Limpiar la ruta para asegurarnos que es relativa
      const cleanPath = filePath.startsWith('/')
        ? filePath.substring(1)
        : filePath;

      // Construir la ruta completa
      const fullPath = path.join(environment.uploadsPath, cleanPath);

      // Verificar si el archivo existe
      if (fs.existsSync(fullPath)) {
        // Eliminar el archivo
        fs.unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al eliminar el archivo:', error);
      return false;
    }
  }

  /**
   * Asegura que un directorio exista, creándolo si es necesario
   * @param dirPath Ruta del directorio
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
