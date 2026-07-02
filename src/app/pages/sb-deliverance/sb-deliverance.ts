import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SbDeliveranceService, SbDeliveranceData } from '../../services/sb-deliverance.service';
import { PieChart } from './pie-chart';

interface HorizonOption {
  text: string;
  value: string;
}

@Component({
  selector: 'app-sb-deliverance',
  standalone: true,
  imports: [CommonModule, FormsModule, PieChart],
  template: `
    <section class="page">
      <div class="toolbar">
        <div class="field">
          <label for="horizon-filter">Horizon</label>
          <select id="horizon-filter" [ngModel]="selectedHorizon()" (ngModelChange)="onHorizonChange($event)">
            <option value="">-- Select Horizon --</option>
            @for (horizon of horizons(); track horizon.value) {
              <option [value]="horizon.value">{{ horizon.text }}</option>
            }
          </select>
        </div>

        <button class="btn-refresh" type="button" (click)="loadData()" [disabled]="loading() || !selectedHorizon()">
          {{ loading() ? 'Refreshing...' : 'Refresh Data' }}
        </button>
      </div>

      @if (loading()) {
        <p class="status">Loading deliverance data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (data()) {
        <div class="content-grid">
          <div class="chart-section">
            <h2>Deliverance Status Summary</h2>
            <app-pie-chart
              [labels]="['Complete <= due date', 'Published within 7 days after overdue', 'Published after 7 days from due date']"
              [data]="[data()!.summary.green, data()!.summary.lightGreen, data()!.summary.red]"
              [colors]="['#16a34a', '#84cc16', '#dc2626']"
            ></app-pie-chart>
            <div class="legend">
              <div class="legend-item">
                <span class="legend-color green"></span>
                <span>Complete &lt;= due date: {{ data()!.summary.green }}</span>
              </div>
              <div class="legend-item">
                <span class="legend-color light-green"></span>
                <span>Published within 7 days after overdue: {{ data()!.summary.lightGreen }}</span>
              </div>
              <div class="legend-item">
                <span class="legend-color red"></span>
                <span>Published after 7 days from due date: {{ data()!.summary.red }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="table-section">
          <h2>Deliverance Status by Service Bundle Owner</h2>
          <div class="table-wrap" role="region" aria-label="Deliverance status by owner" tabindex="0">
            <table>
              <thead>
                <tr>
                  <th scope="col">Service Bundle Owner</th>
                  <th scope="col" class="num-h">Complete <= due date</th>
                  <th scope="col" class="num-h">Published within 7 days after overdue</th>
                  <th scope="col" class="num-h">Published after 7 days from due date</th>
                  <th scope="col" class="num-h">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (owner of data()!.byOwner; track owner.sbOwner) {
                  <tr>
                    <td>{{ owner.sbOwner || 'Unassigned' }}</td>
                    <td class="num status-green">{{ owner.green }}</td>
                    <td class="num status-light-green">{{ owner.lightGreen }}</td>
                    <td class="num status-red">{{ owner.red }}</td>
                    <td class="num status-total"><strong>{{ owner.green + owner.lightGreen + owner.red }}</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <p class="status">No deliverance data available. Please select a horizon and refresh.</p>
      }
    </section>
  `,
  styles: [`
    .page {
      padding: 1.5rem 1.5rem 1.5rem 3rem;
      font-family: 'Source Sans Pro', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.92rem;
      color: #1f2937;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      align-items: flex-end;
      margin-bottom: 1.5rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1rem 1.1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      min-width: 190px;
    }

    .field label {
      font-weight: 600;
      font-size: 0.8rem;
      color: #374151;
    }

    .field select {
      padding: 0.48rem 0.65rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      font-family: inherit;
      background: #fff;
    }

    .btn-refresh {
      border: 1px solid #8b2f62;
      background: #8b2f62;
      color: #fff;
      padding: 0.5rem 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .status {
      padding: 1rem;
      text-align: center;
      color: #6b7280;
    }

    .status-error {
      color: #dc2626;
      background: #fee2e2;
      border-radius: 6px;
      padding: 1rem;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .chart-section {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 6px 16px rgba(31, 41, 55, 0.04);
    }

    .chart-section h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 1.5rem 0;
      color: #1f2937;
    }

    .legend {
      display: flex;
      gap: 2rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    .legend-color {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }

    .legend-color.green {
      background: #16a34a;
    }

    .legend-color.light-green {
      background: #84cc16;
    }

    .legend-color.red {
      background: #dc2626;
    }

    .table-section {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 6px 16px rgba(31, 41, 55, 0.04);
    }

    .table-section h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
      color: #1f2937;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    thead {
      background: #f3f4f6;
      border-bottom: 2px solid #d1d5db;
    }

    th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
    }

    th.num-h {
      text-align: right;
      padding-right: 1.5rem;
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e5e7eb;
    }

    td.num {
      text-align: right;
      padding-right: 1.5rem;
      font-weight: 500;
    }

    td.status-green {
      color: #16a34a;
    }

    td.status-light-green {
      color: #84cc16;
    }

    td.status-red {
      color: #dc2626;
    }

    td.status-total {
      background: #f9fafb;
      font-weight: 600;
    }

    tbody tr:hover {
      background: #f9fafb;
    }
  `],
})
export class SbDeliverance implements OnInit {
  private readonly api = inject(SbDeliveranceService);

  protected readonly horizons = signal<HorizonOption[]>([]);
  protected readonly selectedHorizon = signal<string>('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<SbDeliveranceData | null>(null);

  ngOnInit(): void {
    this.api.getHorizons().subscribe({
      next: (horizons) => {
        this.horizons.set(horizons);
        if (horizons.length > 0) {
          this.selectedHorizon.set(horizons[0].value);
          this.loadData();
        }
      },
      error: () => {
        this.error.set('Failed to load horizons.');
      },
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    if (value) {
      this.loadData();
    }
  }

  protected loadData(): void {
    const horizon = this.selectedHorizon();
    if (!horizon) {
      this.error.set('Please select a horizon.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.getDeliveranceStatus(horizon).subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load deliverance data. ' + (err.message || ''));
        this.loading.set(false);
      },
    });
  }
}
