import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, forkJoin } from 'rxjs';
import { skip, takeUntil } from 'rxjs/operators';
import {
  MetricsService,
  MetricEvent,
  MetricsConfig,
  DayMetric,
  SummaryMetric,
} from '../../../shared/services/features/metrics.service';
import { TextFieldComponent } from '../../../shared/components/app-text-field/app-text-field.component';

const COLOR_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgb(34, 197, 94)' },
  { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgb(249, 115, 22)' },
  { bg: 'rgba(139, 92, 246, 0.2)', border: 'rgb(139, 92, 246)' },
  { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgb(236, 72, 153)' },
  { bg: 'rgba(6, 182, 212, 0.2)', border: 'rgb(6, 182, 212)' },
];

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + (r.getDay() === 0 ? -6 : 1 - r.getDay()));
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ChartModule,
    TranslocoModule,
    TextFieldComponent,
    TooltipModule,
  ],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private cd = inject(ChangeDetectorRef);
  private transloco = inject(TranslocoService);
  private metricsSrv = inject(MetricsService);
  private fb = inject(FormBuilder); // ✅ inyectado
  private destroy$ = new Subject<void>();

  // ── Métricas ──────────────────────────────────────────────
  loading = signal(false);
  readonly ranges = ['today', 'week', 'month', 'custom'] as const;
  selectedRange = signal<(typeof this.ranges)[number]>('week');
  customStart = signal(toISODate(new Date(Date.now() - 7 * 86400000)));
  customEnd = signal(toISODate(new Date()));
  summary = signal<SummaryMetric | null>(null);
  events = signal<MetricEvent[]>([]);

  lineChartData = signal<any>({ labels: [], datasets: [] });
  lineChartOptions = signal<any>({});
  barChartData = signal<any>({ labels: [], datasets: [] });
  barChartOptions = signal<any>({});
  pieChartData = signal<any>({ labels: [], datasets: [] });
  pieChartOptions = signal<any>({});

  serverTime = signal<{ server_time: string; timezone: string } | null>(null);

  // ── Config ────────────────────────────────────────────────
  showConfigPanel = signal(false);
  config = signal<MetricsConfig | null>(null);
  savingConfig = signal(false);
  loadingConfig = signal(false);
  eventsFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  ngOnInit(): void {
    this.load();
    this.loadServerTime();

    this.transloco.langChanges$
      .pipe(
        skip(1), // ← ignora la emisión inicial de carga
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRangeChange(range: (typeof this.ranges)[number]): void {
    this.selectedRange.set(range);
    if (range !== 'custom') this.load();
  }

  onCustomDateChange(): void {
    if (this.customStart() && this.customEnd()) this.load();
  }

  private getDateRange(): { start: string; end: string } {
    const today = new Date();
    switch (this.selectedRange()) {
      case 'today':
        return { start: toISODate(today), end: toISODate(today) };
      case 'week':
        return { start: toISODate(startOfWeek(today)), end: toISODate(today) };
      case 'month':
        return { start: toISODate(startOfMonth(today)), end: toISODate(today) };
      case 'custom':
        return { start: this.customStart(), end: this.customEnd() };
    }
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loading.set(true);
    const { start, end } = this.getDateRange();

    forkJoin({
      range: this.metricsSrv.getRange(start, end),
      summary: this.metricsSrv.getSummary(start, end),
      config: this.metricsSrv.getConfig(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ range, summary, config }) => {
          this.summary.set(summary);

          // Derivar los eventos activos desde la config
          const activeEvents: MetricEvent[] = (config.events ?? []).filter(
            (e) => e.is_active,
          );

          this.events.set(activeEvents);
          this.buildCharts(range, activeEvents);
          this.loading.set(false);
          this.cd.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cd.markForCheck();
        },
      });
  }

  private loadServerTime(): void {
    this.metricsSrv
      .getServerTime()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.serverTime.set(data);
          this.cd.markForCheck();
        },
        error: () => {},
      });
  }

  // ── Config ────────────────────────────────────────────────
  openConfig(): void {
    this.loadingConfig.set(true);
    this.metricsSrv
      .getConfig()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.loadEventsFromConfig(cfg.events);
          this.showConfigPanel.set(true);
          this.loadingConfig.set(false);
          this.cd.markForCheck();
        },
        error: () => {
          this.loadingConfig.set(false);
          this.cd.markForCheck();
        },
      });
  }

  closeConfig(): void {
    this.showConfigPanel.set(false);
    this.eventsFormArray.clear();
  }

  private loadEventsFromConfig(events: MetricEvent[]): void {
    this.eventsFormArray.clear();
    events.forEach((ev) => {
      this.eventsFormArray.push(
        this.fb.group({
          event_name: [ev.event_name, Validators.required],
          label: [ev.label, Validators.required],
          is_active: [ev.is_active],
        }),
      );
    });
  }

  addEventRow(): void {
    this.eventsFormArray.push(
      this.fb.group({
        event_name: ['', Validators.required],
        label: ['', Validators.required],
        is_active: [true],
      }),
    );
    this.cd.markForCheck();
  }

  removeEventRow(index: number): void {
    const eventName = this.eventsFormArray.at(index).get('event_name')?.value;
    if (!eventName) {
      this.eventsFormArray.removeAt(index);
      this.cd.markForCheck();
      return;
    }
    this.metricsSrv
      .deleteEvent(eventName)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.eventsFormArray.removeAt(index);
        this.load();
        this.cd.markForCheck();
      });
  }

  toggleEventActive(index: number): void {
    const control = this.eventsFormArray.at(index);
    const eventName = control.get('event_name')?.value;
    const newValue = !control.get('is_active')?.value;
    if (!eventName) return;
    control.get('is_active')?.setValue(newValue);
    this.metricsSrv
      .updateEvent(eventName, undefined, newValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.load();
        this.cd.markForCheck();
      });
  }

  saveEvent(index: number): void {
    const control = this.eventsFormArray.at(index);
    if (control.invalid) {
      control.markAllAsTouched();
      this.cd.markForCheck();
      return;
    }

    const event_name = control.get('event_name')?.value.trim();
    const label = control.get('label')?.value.trim();
    const is_active = control.get('is_active')?.value;

    this.savingConfig.set(true);
    const existsInConfig = this.config()?.events.some(
      (e) => e.event_name === event_name,
    );
    const request$ = existsInConfig
      ? this.metricsSrv.updateEvent(event_name, label, is_active)
      : this.metricsSrv.addEvent(event_name, label);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.savingConfig.set(false);
        this.load();
        this.cd.markForCheck();
      },
      error: () => {
        this.savingConfig.set(false);
        this.cd.markForCheck();
      },
    });
  }

  getEventControl(index: number, field: string): FormControl {
    return this.eventsFormArray.at(index).get(field) as FormControl;
  }

  // ── Gráficas ──────────────────────────────────────────────
  private buildCharts(data: DayMetric[], events: MetricEvent[]): void {
    const docStyle = getComputedStyle(document.documentElement);
    const textColor = docStyle.getPropertyValue('--p-text-color') || '#374151';
    const textMuted =
      docStyle.getPropertyValue('--p-text-muted-color') || '#6B7280';
    const borderColor =
      docStyle.getPropertyValue('--p-content-border-color') || '#E5E7EB';

    const commonOptions = {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { size: 13 } } } },
      scales: {
        x: { ticks: { color: textMuted }, grid: { color: borderColor } },
        y: {
          beginAtZero: true,
          ticks: { color: textMuted },
          grid: { color: borderColor },
        },
      },
    };

    const totals = this.summary();

    this.lineChartData.set({
      labels: data.map((d) => d.date),
      datasets: events.map((ev, i) => {
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
        return {
          label: ev.label,
          data: data.map((d) => d.counters[ev.event_name] ?? 0),
          borderColor: color.border,
          backgroundColor: color.bg,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
        };
      }),
    });

    this.barChartData.set({
      labels: events.map((ev) => ev.label),
      datasets: [
        {
          label: this.transloco.translate(
            'components.statistics.chart_labels.total',
          ),
          data: events.map((ev) => totals?.totals[ev.event_name] ?? 0),
          backgroundColor: events.map(
            (_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length].bg,
          ),
          borderColor: events.map(
            (_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length].border,
          ),
          borderWidth: 1,
        },
      ],
    });

    this.lineChartOptions.set({ ...commonOptions });
    this.barChartOptions.set({ ...commonOptions });

    // ── Pastel — proporción de totales por evento ──────────────
    const totalsValues = events.map((ev) => totals?.totals[ev.event_name] ?? 0);
    const hasData = totalsValues.some((v) => v > 0);

    this.pieChartData.set({
      labels: events.map((ev) => ev.label),
      datasets: [
        {
          data: totalsValues,
          backgroundColor: events.map(
            (_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length].border,
          ),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    });

    this.pieChartOptions.set({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, font: { size: 13 }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const total = ctx.dataset.data.reduce(
                (a: number, b: number) => a + b,
                0,
              );
              const pct =
                total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
        },
      },
    });
  }

  get summaryEntries(): { key: string; label: string; value: number }[] {
    const s = this.summary();
    if (!s) return [];
    const evMap = Object.fromEntries(
      this.events().map((e) => [e.event_name, e.label]),
    );
    return Object.entries(s.totals).map(([key, value]) => ({
      key,
      label: evMap[key] ?? key,
      value,
    }));
  }

  colorForIndex(i: number): string {
    return COLOR_PALETTE[i % COLOR_PALETTE.length].border;
  }
  bgColorForIndex(i: number): string {
    return COLOR_PALETTE[i % COLOR_PALETTE.length].bg;
  }
  getInputValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
}
