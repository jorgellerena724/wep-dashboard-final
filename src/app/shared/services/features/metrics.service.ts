import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MetricEvent {
  event_name: string;
  label: string;
  is_active: boolean;
}

export interface MetricsConfig {
  id: number;
  events: MetricEvent[];
}

export interface DayMetric {
  date: string;
  counters: Record<string, number>;
}

export interface SummaryMetric {
  start_date: string;
  end_date: string;
  days_with_data: number;
  totals: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private http = inject(HttpClient);
  private urlMetrics = `${environment.api}metrics`;
  private urlConfig = `${environment.api}metrics-config`;

  // ── Métricas ──────────────────────────────────────────────
  getToday(): Observable<DayMetric> {
    return this.http.get<DayMetric>(`${this.urlMetrics}/today/`);
  }

  getServerTime(): Observable<{ server_time: string; timezone: string }> {
    return this.http.get<{ server_time: string; timezone: string }>(
      `${this.urlMetrics}/server-time/`,
    );
  }

  getRange(startDate: string, endDate: string): Observable<DayMetric[]> {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<DayMetric[]>(`${this.urlMetrics}/range/`, { params });
  }

  getSummary(startDate: string, endDate: string): Observable<SummaryMetric> {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<SummaryMetric>(`${this.urlMetrics}/summary/`, {
      params,
    });
  }

  getEvents(): Observable<{ events: MetricEvent[] }> {
    return this.http.get<{ events: MetricEvent[] }>(
      `${this.urlMetrics}/events/`,
    );
  }

  // ── Config ────────────────────────────────────────────────
  getConfig(): Observable<MetricsConfig> {
    return this.http.get<MetricsConfig>(`${this.urlConfig}/config/`);
  }

  addEvent(event_name: string, label: string): Observable<MetricsConfig> {
    const params = new HttpParams()
      .set('event_name', event_name)
      .set('label', label);
    return this.http.post<MetricsConfig>(
      `${this.urlConfig}/config/event/`,
      null,
      { params },
    );
  }

  updateEvent(
    event_name: string,
    label?: string,
    is_active?: boolean,
  ): Observable<MetricsConfig> {
    let params = new HttpParams();
    if (label !== undefined) params = params.set('label', label);
    if (is_active !== undefined) params = params.set('is_active', is_active);
    return this.http.patch<MetricsConfig>(
      `${this.urlConfig}/config/event/${event_name}/`,
      null,
      { params },
    );
  }

  deleteEvent(event_name: string): Observable<void> {
    return this.http.delete<void>(
      `${this.urlConfig}/config/event/${event_name}/`,
    );
  }
}
