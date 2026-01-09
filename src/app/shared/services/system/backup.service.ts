import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BackupService {
  private apiUrl = environment.api;
  
  // Signals para estados
  public isDownloading = signal<boolean>(false);
  public isRestoring = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  /**
   * Descarga el backup de la base de datos y carpeta uploads
   */
  downloadBackup(): Observable<Blob> {
    this.isDownloading.set(true);
    return this.http.get(`${this.apiUrl}backup/download`, {
      responseType: 'blob',
    }).pipe(
      tap(() => this.isDownloading.set(false))
    );
  }

  /**
   * Restaura un backup desde un archivo ZIP
   */
  restoreBackup(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    this.isRestoring.set(true);
    return this.http.post(`${this.apiUrl}backup/restore`, formData).pipe(
      tap(() => this.isRestoring.set(false))
    );
  }
}

