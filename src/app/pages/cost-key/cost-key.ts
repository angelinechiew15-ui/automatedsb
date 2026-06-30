import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CostKeyOverviewRow, CostKeyService } from '../../services/cost-key.service';

interface SummaryCard {
  label: string;
  value: string;
}

@Component({
  selector: 'app-cost-key',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="hero">
        <div>
          <p class="eyebrow">Cost Key</p>
          <h1>Cost Key Overview</h1>
          <p class="lede">
            View the backend cost-key rollup by fiscal year, location, and service bundle.
          </p>
        </div>
        <button class="btn-refresh" type="button" (click)="loadData()" [disabled]="loading()">
          {{ loading() ? 'Refreshing...' : 'Refresh overview' }}
        </button>
      </div>

      <div class="toolbar">
        <div class="field">
          <label for="fy-filter">FY</label>
          <select id="fy-filter" [ngModel]="selectedFy()" (ngModelChange)="selectedFy.set($event)">
            <option value="">All</option>
            @for (fy of fyOptions(); track fy) {
              <option [value]="fy">{{ fy }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="loc-filter">Location</label>
          <select id="loc-filter" [ngModel]="selectedLoc()" (ngModelChange)="selectedLoc.set($event)">
            <option value="">All</option>
            @for (loc of locOptions(); track loc) {
              <option [value]="loc">{{ loc }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="sb-filter">Service Bundle</label>
          <select id="sb-filter" [ngModel]="selectedSb()" (ngModelChange)="selectedSb.set($event)">
            <option value="">All</option>
            @for (sb of sbOptions(); track sb) {
              <option [value]="sb">{{ sb }}</option>
            }
          </select>
        </div>
      </div>

      <div class="summary-grid">
        @for (card of summaryCards(); track card.label) {
          <article class="summary-card">
            <span class="summary-label">{{ card.label }}</span>
            <strong class="summary-value">{{ card.value }}</strong>
          </article>
        }
      </div>

      @if (loading()) {
        <p class="status">Loading cost key overview...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!rows().length) {
        <p class="status">No cost key data returned from the API.</p>
      } @else if (!filteredRows().length) {
        <p class="status">No rows match the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Cost key overview table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">Service Bundle</th>
                <th scope="col">Client Corridor</th>
                <th scope="col">WBS Element</th>
                <th scope="col" class="num-h">CC %</th>
                <th scope="col" class="num-h">Cost (k EUR)</th>
                <th scope="col" class="num-h">Key</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.fy + '|' + row.loc + '|' + row.serviceBundle + '|' + row.clientCorridor) {
                <tr>
                  <td>{{ row.loc }}</td>
                  <td>{{ row.serviceBundle }}</td>
                  <td>{{ row.clientCorridor || '—' }}</td>
                  <td>{{ row.wbsElement || '—' }}</td>
                  <td class="num">{{ formatPercent(row.ccPercent) }}</td>
                  <td class="num">{{ formatAmount(row.costKeur) }}</td>
                  <td class="num">{{ formatKey(row.key) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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

    .hero {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      padding: 1.25rem 1.35rem;
      margin-bottom: 1rem;
      border: 1px solid #dfe3ea;
      border-radius: 14px;
      background: linear-gradient(135deg, #fff8fc 0%, #ffffff 58%, #f4f7fb 100%);
      box-shadow: 0 12px 26px rgba(31, 41, 55, 0.06);
    }

    .eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #8b2f62;
      font-weight: 700;
    }

    h1 {
      margin: 0;
      font-size: 1.7rem;
      line-height: 1.15;
      color: #111827;
    }

    .lede {
      margin: 0.4rem 0 0;
      max-width: 52rem;
      color: #4b5563;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      align-items: flex-end;
      margin-bottom: 1rem;
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

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .summary-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fff;
      padding: 0.9rem 1rem;
      box-shadow: 0 6px 16px rgba(31, 41, 55, 0.04);
    }

    .summary-label {
      display: block;
      font-size: 0.78rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.35rem;
      font-weight: 700;
    }

    .summary-value {
      font-size: 1.1rem;
      color: #111827;
    }

    .status {
      margin-top: 0.75rem;
      color: #6b7280;
    }

    .status-error {
      color: #b00020;
    }

    .table-wrap {
      margin-top: 1rem;
      overflow: auto;
      max-height: 70vh;
      border: 1px solid #d9dde3;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 10px 24px rgba(31, 41, 55, 0.05);
    }

    table {
      border-collapse: collapse;
      width: 100%;
      min-width: 1400px;
      table-layout: fixed;
    }

    th,
    td {
      padding: 0.55rem 0.65rem;
      border: 1px solid #e5e7eb;
      text-align: left;
      font-size: 0.8rem;
      vertical-align: top;
      line-height: 1.35;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    thead th {
      background: #8b2f62;
      color: #fff;
      font-weight: 700;
      position: sticky;
      top: 0;
      z-index: 2;
    }

    tbody tr:hover {
      background: #faf5f8;
    }

    .num-h,
    .num {
      text-align: right;
    }
  `],
})
export class CostKey implements OnInit {
  private readonly api = inject(CostKeyService);

  protected readonly rows = signal<CostKeyOverviewRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedFy = signal('');
  protected readonly selectedLoc = signal('');
  protected readonly selectedSb = signal('');

  protected readonly fyOptions = computed(() => [...new Set(this.rows().map((row) => row.fy).filter(Boolean))].sort());
  protected readonly locOptions = computed(() => [...new Set(this.rows().map((row) => row.loc).filter(Boolean))].sort());
  protected readonly sbOptions = computed(() => [...new Set(this.rows().map((row) => row.serviceBundle).filter(Boolean))].sort());

  protected readonly filteredRows = computed(() => {
    const fy = this.selectedFy();
    const loc = this.selectedLoc();
    const sb = this.selectedSb();

    return this.rows()
      .filter((row) => (!fy || row.fy === fy) && (!loc || row.loc === loc) && (!sb || row.serviceBundle === sb))
      .slice()
      .sort((a, b) => {
        const byFy = a.fy.localeCompare(b.fy);
        if (byFy !== 0) {
          return byFy;
        }
        const byLoc = a.loc.localeCompare(b.loc);
        if (byLoc !== 0) {
          return byLoc;
        }
        return a.serviceBundle.localeCompare(b.serviceBundle);
      });
  });

  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const rows = this.filteredRows();
    const totalCost = rows.reduce((sum, row) => sum + (row.costKeur ?? 0), 0);
    const avgKey = rows.length
      ? rows.reduce((sum, row) => sum + (row.key ?? 0), 0) / rows.length
      : 0;

    return [
      { label: 'Rows', value: this.formatCount(rows.length) },
      { label: 'Total Cost (k EUR)', value: this.formatAmount(totalCost) },
      { label: 'Average Key', value: this.formatKey(avgKey) },
    ];
  });

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getOverview().subscribe({
      next: (data) => {
        this.rows.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load cost key overview.');
      },
    });
  }

  protected formatAmount(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected formatKey(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * 100)}%`;
  }

  protected formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '—';
    }
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * 100)}%`;
  }

  protected formatCount(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
}
