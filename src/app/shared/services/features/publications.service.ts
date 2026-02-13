import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PublicationData } from '../../interfaces/publications.interface';

@Injectable({
  providedIn: 'root',
})
export class PublicationsService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  constructor(private http: HttpClient) {}

  get(): Observable<PublicationData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<PublicationData[]>(
      this.apiUrl + `publications/?no-cache=${timestamp}`
    );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    const url = `${this.imgUrl}${name}/?no-cache=${timestamp}`;
    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'publications/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}publications/${id}/`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}publications/${id}`, {
      body: { id: id },
    });
  }
}
