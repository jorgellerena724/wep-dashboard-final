import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private apiUrl = environment.api;

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `category/?no-cache=${timestamp}`
    );
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'category/', data);
  }

  patch(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}category/${id}/`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}category/${id}/`, {
      body: { id: id },
    });
  }
}
