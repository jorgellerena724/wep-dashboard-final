import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HeaderData } from '../../interfaces/headerData.interface';

@Injectable({
  providedIn: 'root',
})
export class HeaderService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  constructor(private http: HttpClient) {}

  get(): Observable<HeaderData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HeaderData[]>(
      this.apiUrl + `header/?no-cache=${timestamp}`
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
    return this.http.post<any[]>(this.apiUrl + 'header/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}header/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}header/${id}`, {
      body: { id: id },
    });
  }
}
