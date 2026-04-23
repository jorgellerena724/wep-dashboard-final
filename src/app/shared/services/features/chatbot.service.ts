import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HomeData } from '../../interfaces/home.interface';

export interface ChatbotProviderItem {
  provider: string;
  api_key: string;
}

export interface ChatbotConfigPayload {
  user_id: number;
  models: ChatbotProviderItem[];
  prompt: string;
  temperature: number;
}

export interface ChatbotModelInfo {
  provider: string;
  api_key: string;
  tokens_used: number;
  tokens_limit: number;
  tokens_remaining: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private apiUrl = environment.api;

  constructor(private http: HttpClient) {}

  get(): Observable<HomeData[]> {
    const timestamp = new Date().getTime();
    return this.http.get<HomeData[]>(
      this.apiUrl + `chat/config/?no-cache=${timestamp}`
    );
  }

  post(data: ChatbotConfigPayload): Observable<any> {
    return this.http.post<any>(this.apiUrl + 'chat/config/', data);
  }

  patch(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}chat/config/${id}/`, data);
  }

  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}chat/config/${id}/`, {
      body: { id: id },
    });
  }

  getModels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}chat/models/`);
  }

  postModel(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}chat/models/`, data);
  }

  patchModel(data: any, id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}chat/models/${id}/`, data);
  }

  deleteModel(modelId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}chat/models/${modelId}`);
  }

  getProviders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}chat/models/?active_only=false`);
  }
}
