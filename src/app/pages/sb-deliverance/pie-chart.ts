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

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styles: [':host{display:block;position:relative;width:100%;height:320px}'],
})
export class PieChart implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() colors: string[] = [];

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

    this.chart?.destroy();

    const colors = this.colors.length === this.data.length
      ? this.colors
      : ['#16a34a', '#84cc16', '#dc2626'];

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: this.labels,
        datasets: [
          {
            data: this.data,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }
}
