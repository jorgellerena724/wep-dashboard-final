import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ContactData } from '../../interfaces/contact.interface';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private apiUrl = environment.api;

  constructor(private http: HttpClient) {}

  get(): Observable<ContactData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<ContactData[]>(
      this.apiUrl + `contact/?no-cache=${timestamp}`
    );
  }

  patch(formData: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}contact/${id}`, formData);
  }
}
