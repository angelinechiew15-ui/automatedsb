import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

/** One series in a multi-dataset chart. */
export interface ChartSeries {
  label: string;
  data: number[];
  color: string;
  /** Render this series as a line or a bar (for mixed charts). */
  kind?: 'line' | 'bar';
  /** Which y-axis to plot against. 'y1' renders a second axis on the right. */
  axis?: 'y' | 'y1';
}

@Component({
  selector: 'app-chart-canvas',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styles: [':host{display:block;position:relative;width:100%;height:320px}'],
})
export class ChartCanvas implements AfterViewInit, OnChanges, OnDestroy {
  @Input() type: ChartType = 'bar';
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() label = '';
  @Input() color = '#0a8276';
  /** Optional multi-series data. When set, `data`/`label`/`color` are ignored. */
  @Input() datasets?: ChartSeries[];

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private chart?: Chart;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(): void {
    if (this.viewReady) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    if (!this.isBrowser || !this.canvasRef) {
      return;
    }

    // Rebuild on every change to keep dataset count/axes consistent.
    this.chart?.destroy();

    const useSecondAxis = (this.datasets ?? []).some((d) => d.axis === 'y1');

    const datasets = this.datasets
      ? this.datasets.map((d) => {
          const kind = d.kind ?? (this.type === 'line' ? 'line' : 'bar');
          return {
            type: kind,
            label: d.label,
            data: d.data,
            backgroundColor: kind === 'line' ? 'transparent' : d.color,
            borderColor: d.color,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: kind === 'line' ? 3 : 0,
            fill: false,
            yAxisID: d.axis ?? 'y',
            order: kind === 'line' ? 0 : 1,
          };
        })
      : [
          {
            label: this.label,
            data: this.data,
            backgroundColor: this.type === 'line' ? 'transparent' : this.color,
            borderColor: this.color,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: this.type === 'line' ? 3 : 0,
            fill: false,
            yAxisID: 'y',
          },
        ];

    const showLegend = this.datasets ? true : !!this.label;

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: showLegend },
        },
        scales: {
          y: { beginAtZero: true, position: 'left' },
          ...(useSecondAxis
            ? {
                y1: {
                  beginAtZero: true,
                  position: 'right' as const,
                  grid: { drawOnChartArea: false },
                },
              }
            : {}),
        },
      },
    });
  }
}
