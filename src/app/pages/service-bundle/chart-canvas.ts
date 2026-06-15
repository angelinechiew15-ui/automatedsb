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
  /** Optional left y-axis title (e.g. 'TSpM', 'RTU', 'k EUR'). */
  @Input() yAxisLabel = '';

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
            tension: 0,
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
            tension: 0,
            pointRadius: this.type === 'line' ? 3 : 0,
            fill: false,
            yAxisID: 'y',
          },
        ];

    const showLegend = this.datasets ? true : !!this.label;

    // Draws each data value: bar values near the bottom of the bar, line values
    // above the line point — kept apart so they don't overlap. Always black.
    const valueLabels = {
      id: 'valueLabels',
      afterDatasetsDraw: (chart: Chart) => {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '400 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        chart.data.datasets.forEach((ds, i) => {
          const meta = chart.getDatasetMeta(i);
          if (meta.hidden) {
            return;
          }
          const isLine = (ds as { type?: string }).type === 'line';
          meta.data.forEach((el, j) => {
            const raw = ds.data[j] as number;
            if (raw === null || raw === undefined) {
              return;
            }
            const point = el as unknown as { x: number; y: number; base?: number };
            if (isLine) {
              ctx.textBaseline = 'bottom';
              ctx.fillText(String(raw), point.x, point.y - 6);
            } else {
              const base = point.base ?? point.y;
              ctx.textBaseline = 'bottom';
              ctx.fillText(String(raw), point.x, base - 4);
            }
          });
        });
        ctx.restore();
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets,
      },
      plugins: [valueLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: showLegend, position: 'bottom' },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            position: 'left',
            display: true,
            grid: { display: true },
            title: { display: !!this.yAxisLabel, text: this.yAxisLabel },
          },
          ...(useSecondAxis
            ? {
                y1: {
                  beginAtZero: true,
                  position: 'right' as const,
                  display: true,
                  grid: { drawOnChartArea: false },
                },
              }
            : {}),
        },
      },
    });
  }
}
