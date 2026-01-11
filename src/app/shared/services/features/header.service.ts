import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HeaderData } from '../../interfaces/headerData.interface';

@Injectable({
  providedIn: 'root',
})
export class HeaderService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;

  // Signal para cachear datos
  private dataSignal = signal<HeaderData[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  get(): Observable<HeaderData[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }

    this.isLoading.set(true);
    const timestamp = new Date().getTime();
    return this.http
      .get<HeaderData[]>(this.apiUrl + `header/?no-cache=${timestamp}`)
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
      .post<any[]>(this.apiUrl + 'header/', data)
      .pipe(tap(() => this.invalidateCache()));
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http
      .patch(`${this.apiUrl}header/${id}`, formData)
      .pipe(tap(() => this.invalidateCache()));
  }

  delete(id: number): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}header/${id}`, {
        body: { id: id },
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
