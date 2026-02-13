import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class NewsService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `news/?no-cache=${timestamp}`
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
    return this.http.post<any[]>(this.apiUrl + 'news/', data);
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}news/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}news/${id}`, {
      body: { id: id },
    });
  }

  toggleStatus(id: number): Observable<any[]> {
    return this.http.patch<any[]>(`${this.apiUrl}news/status/${id}`, {
      id: id,
    });
  }

  updateOrder(id: number, newOrder: number): Observable<any> {
    const formData = new FormData();
    formData.append('order', newOrder.toString());
    return this.http.patch(`${this.apiUrl}news/${id}`, formData);
  }
}
