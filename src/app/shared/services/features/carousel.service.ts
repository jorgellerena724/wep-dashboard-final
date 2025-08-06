import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class CarouselService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  constructor(private http: HttpClient, private authService: AuthService) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `carrousel/?no-cache=${timestamp}`
    );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    const url = `${
      this.imgUrl
    }${this.authService.getClient()}/${name}?no-cache=${timestamp}`;
    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'carrousel/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}carrousel/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}carrousel/${id}`, {
      body: { id: id },
    });
  }
}
