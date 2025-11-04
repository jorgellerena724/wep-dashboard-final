import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BackupService {
  private apiUrl = environment.api;

  constructor(private http: HttpClient) {}

  /**
   * Descarga el backup de la base de datos y carpeta uploads
   */
  downloadBackup(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}backup/download`, {
      responseType: 'blob',
    });
  }

  /**
   * Restaura un backup desde un archivo ZIP
   */
  restoreBackup(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.apiUrl}backup/restore`, formData);
  }
}

