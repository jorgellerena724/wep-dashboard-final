import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ContactData } from '../../interfaces/contact.interface';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private apiUrl = environment.api;

  // Signal para cachear datos
  private dataSignal = signal<ContactData[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  get(): Observable<ContactData[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }
    
    this.isLoading.set(true);
    const timestamp = new Date().getTime();
    return this.http.get<ContactData[]>(
      this.apiUrl + `contact/?no-cache=${timestamp}`
    ).pipe(
      tap(data => {
        this.dataSignal.set(data);
        this.isLoading.set(false);
      })
    );
  }

  patch(formData: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}contact/${id}`, formData).pipe(
      tap(() => this.invalidateCache())
    );
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
