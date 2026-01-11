import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class NewsService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

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
    return this.http
      .get<HomeData[]>(this.apiUrl + `news/?no-cache=${timestamp}`)
      .pipe(
        tap((data) => {
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
    return this.http
      .post<any[]>(this.apiUrl + 'news/', data)
      .pipe(tap(() => this.invalidateCache()));
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http
      .patch(`${this.apiUrl}news/${id}`, formData)
      .pipe(tap(() => this.invalidateCache()));
  }

  delete(id: number): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}news/${id}`, {
        body: { id: id },
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  toggleStatus(id: number): Observable<any[]> {
    return this.http
      .patch<any[]>(`${this.apiUrl}news/status/${id}`, {
        id: id,
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  updateOrder(id: number, newOrder: number): Observable<any> {
    const formData = new FormData();
    formData.append('order', newOrder.toString());
    return this.http
      .patch(`${this.apiUrl}news/${id}`, formData)
      .pipe(tap(() => this.invalidateCache()));
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
