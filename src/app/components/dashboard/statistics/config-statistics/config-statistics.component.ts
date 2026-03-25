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
import { TranslocoModule } from '@jsverse/transloco';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormArray,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  MetricsService,
  MetricEvent,
  MetricsConfig,
} from '../../../../shared/services/features/metrics.service';
import { TextFieldComponent } from '../../../../shared/components/app-text-field/app-text-field.component';

@Component({
  selector: 'app-config-statistics',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    TextFieldComponent,
    TooltipModule,
  ],
  templateUrl: './config-statistics.component.html',
  styleUrls: ['./config-statistics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigStatisticsComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private cd = inject(ChangeDetectorRef);
  private metricsSrv = inject(MetricsService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // Signals
  loading = signal(false);
  config = signal<MetricsConfig | null>(null);
  savingConfig = signal(false);
  eventsFormArray: FormArray<FormGroup> = new FormArray<FormGroup>([]);

  ngOnInit(): void {
    this.loadConfig();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadConfig(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.loading.set(true);
    this.metricsSrv
      .getConfig()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.loadEventsFromConfig(cfg.events);
          this.loading.set(false);
          this.cd.markForCheck();
        },
        error: () => {
          this.loading.set(false);
          this.cd.markForCheck();
        },
      });
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
        this.loadConfig(); // Recargar la configuración
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
        this.loadConfig(); // Recargar la configuración
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
        this.loadConfig(); // Recargar la configuración
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
}
