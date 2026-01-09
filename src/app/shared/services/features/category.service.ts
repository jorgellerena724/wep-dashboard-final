import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private apiUrl = environment.api;

  // Signal para cachear datos
  private dataSignal = signal<HomeData[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }
    
    this.isLoading.set(true);
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `category/?no-cache=${timestamp}`
    ).pipe(
      tap(data => {
        this.dataSignal.set(data);
        this.isLoading.set(false);
      })
    );
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'category/', data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  patch(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}category/${id}/`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}category/${id}/`, {
      body: { id: id },
    }).pipe(
      tap(() => this.invalidateCache())
    );
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
