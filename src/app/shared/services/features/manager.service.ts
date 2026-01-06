import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class ManagerService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;
  private use_minio = environment.use_minio;

  constructor(private http: HttpClient, private authService: AuthService) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `manager/?no-cache=${timestamp}`
    );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    const url = this.use_minio
      ? `${
          this.imgUrl
        }${this.authService.getClient()}/${name}/?no-cache=${timestamp}`
      : `${this.imgUrl}${name}/?no-cache=${timestamp}`;
    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'manager/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}manager/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}manager/${id}`, {
      body: { id: id },
    });
  }
}
