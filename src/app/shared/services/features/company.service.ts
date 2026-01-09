import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class CompanyService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  // Signal para cachear datos
  private dataSignal = signal<HomeData[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient, private authService: AuthService) {}

  get(): Observable<HomeData[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }
    
    this.isLoading.set(true);
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `company/?no-cache=${timestamp}`
    ).pipe(
      tap(data => {
        this.dataSignal.set(data);
        this.isLoading.set(false);
      })
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
    return this.http.post<any[]>(this.apiUrl + 'company/', data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}company/${id}`, formData).pipe(
      tap(() => this.invalidateCache())
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}company/${id}`, {
      body: { id: id },
    }).pipe(
      tap(() => this.invalidateCache())
    );
  }

  toggleStatus(id: number): Observable<any[]> {
    return this.http.patch<any[]>(`${this.apiUrl}company/status/${id}`, {
      id: id,
    }).pipe(
      tap(() => this.invalidateCache())
    );
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
