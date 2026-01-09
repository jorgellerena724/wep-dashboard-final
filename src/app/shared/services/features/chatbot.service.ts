import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private apiUrl = environment.api;

  // Signals para caché de config y modelos
  private dataSignal = signal<HomeData[] | null>(null);
  private modelsSignal = signal<any[] | null>(null);
  public data = computed(() => this.dataSignal());
  public models = computed(() => this.modelsSignal());
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
      this.apiUrl + `chat/config/?no-cache=${timestamp}`
    ).pipe(
      tap(data => {
        this.dataSignal.set(data);
        this.isLoading.set(false);
      })
    );
  }

  post(data: any): Observable<any[]> {
    return this.http.post<any[]>(this.apiUrl + 'chat/config/', data).pipe(
      tap(() => this.invalidateCache())
    );
  }

  patch(formData: FormData, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}chat/config/${id}/`, formData).pipe(
      tap(() => this.invalidateCache())
    );
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}chat/config/${id}/`, {
      body: { id: id },
    }).pipe(
      tap(() => this.invalidateCache())
    );
  }

  getModels(): Observable<any[]> {
    const cached = this.modelsSignal();
    if (cached) {
      return of(cached);
    }
    
    return this.http.get<any[]>(`${this.apiUrl}chat/models/`).pipe(
      tap(data => this.modelsSignal.set(data))
    );
  }

  postModel(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}chat/models/`, data).pipe(
      tap(() => this.invalidateModelsCache())
    );
  }

  patchModel(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}chat/models/${id}/`, data).pipe(
      tap(() => this.invalidateModelsCache())
    );
  }

  deleteModel(modelId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}chat/models/${modelId}`).pipe(
      tap(() => this.invalidateModelsCache())
    );
  }

  private invalidateCache(): void {
    this.dataSignal.set(null);
  }

  private invalidateModelsCache(): void {
    this.modelsSignal.set(null);
  }
}
