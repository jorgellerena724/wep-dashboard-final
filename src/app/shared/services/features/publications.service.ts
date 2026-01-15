import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PublicationData } from '../../interfaces/publications.interface';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class PublicationsService {
  private apiUrl = environment.api;
  private imgUrl = environment.api_img;
  private use_minio = environment.use_minio;

  // Signal para cachear datos
  private dataSignal = signal<PublicationData[] | null>(null);
  public data = computed(() => this.dataSignal());
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient, private authService: AuthService) {}

  get(): Observable<PublicationData[]> {
    const cached = this.dataSignal();
    if (cached) {
      return of(cached);
    }

    this.isLoading.set(true);
    const timestamp = new Date().getTime();
    return this.http
      .get<PublicationData[]>(
        this.apiUrl + `publications/?no-cache=${timestamp}`
      )
      .pipe(
        tap((data) => {
          this.dataSignal.set(data);
          this.isLoading.set(false);
        })
      );
  }

  getImage(name: string): Observable<Blob> {
    const timestamp = new Date().getTime();
    const url = this.use_minio
      ? `${
          this.imgUrl
        }${this.authService.getClient()}/${name}/?no-cache=${timestamp}`
      : `${this.imgUrl}${name}/?no-cache=${timestamp}`;
    return this.http.get(url, {
      responseType: 'blob',
    });
  }

  post(data: any): Observable<any[]> {
    return this.http
      .post<any[]>(this.apiUrl + 'publications/', data)
      .pipe(tap(() => this.invalidateCache()));
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http
      .patch(`${this.apiUrl}publications/${id}/`, formData)
      .pipe(tap(() => this.invalidateCache()));
  }

  delete(id: number): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}publications/${id}`, {
        body: { id: id },
      })
      .pipe(tap(() => this.invalidateCache()));
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }
}
