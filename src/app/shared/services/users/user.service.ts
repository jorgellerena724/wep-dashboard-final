import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.api_users;

  constructor(private http: HttpClient) {}

  get(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl, data);
  }

  patch(data: any): Observable<any[]> {
    return this.http.patch<any[]>(this.apiUrl + data.id, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(this.apiUrl + id, {
      body: { id: id },
    });
  }

  changePassword(data: any): Observable<any> {
    return this.http.patch<any[]>(this.apiUrl + data.id, {
      newPassword: data.newPassword,
    });
  }
}
