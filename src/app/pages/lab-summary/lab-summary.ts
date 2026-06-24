import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { LabSummaryRow, LookupItem, ServiceBundleService } from '../../services/service-bundle.service';

interface ColDef {
  key: keyof LabSummaryRow;
  label: string;
  type: 'text' | 'num';
}

const COLUMNS: ColDef[] = [
  { key: 'fyQuarter',     label: 'FY Quarter',                   type: 'text' },
  { key: 'location',      label: 'Location',                     type: 'text' },
  { key: 'horizon',       label: 'Horizon',                      type: 'text' },
  { key: 'sb',            label: 'SB',                           type: 'text' },
  { key: 'tsDemand',      label: 'TSpM RFC Demand',              type: 'num'  },
  { key: 'adderTs',       label: 'Adder Value TS Demand',        type: 'num'  },
  { key: 'tsActual',      label: 'TSpM Actual',                  type: 'num'  },
  { key: 'changeTs',      label: 'Adder Value TS Actual',        type: 'num'  },
  { key: 'rtuRfcDemand',  label: 'RTU RFC Demand',               type: 'num'  },
  { key: 'adderRtu',      label: 'Adder Value RTU Demand',       type: 'num'  },
  { key: 'rtuTs',         label: 'RTU/TS',                       type: 'num'  },
  { key: 'rtuActual',     label: 'RTU Actual',                   type: 'num'  },
  { key: 'changeRtu',     label: 'Adder Value RTU Actual',       type: 'num'  },
  { key: 'costRfcWoDepr', label: 'Cost RFC w/o Depreciation',    type: 'num'  },
  { key: 'depreciation',  label: 'Cost RFC Depreciation',        type: 'num'  },
  { key: 'costRfcDemand', label: 'Cost RFC Demand',              type: 'num'  },
  { key: 'adderCost',     label: 'Adder Value Cost Demand',      type: 'num'  },
  { key: 'costRtu',       label: 'Cost/RTU',                     type: 'num'  },
  { key: 'costActual',    label: 'Cost Actual',                  type: 'num'  },
];

@Component({
  selector: 'app-lab-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <h2>Lab Summary</h2>

      <div class="toolbar">
        <div class="field">
          <label>Horizon</label>
          <select [ngModel]="selectedHorizon()" (ngModelChange)="onHorizonChange($event)">
            <option value="">-- Select Horizon --</option>
            @for (h of horizons(); track h.value) {
              <option [value]="h.value">{{ h.text }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>Location</label>
          <select [ngModel]="selectedLoc()" (ngModelChange)="selectedLoc.set($event)">
            <option value="">All</option>
            @for (loc of locOptions(); track loc) {
              <option [value]="loc">{{ loc }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>Service Bundle</label>
          <select [ngModel]="selectedSb()" (ngModelChange)="selectedSb.set($event)">
            <option value="">All</option>
            @for (sb of sbOptions(); track sb) {
              <option [value]="sb">{{ sb }}</option>
            }
          </select>
        </div>

        <div class="field" style="justify-content: flex-end;">
          <button class="btn-export" (click)="exportToExcel()" [disabled]="filteredRows().length === 0">
            &#128190; Export to Excel
          </button>
        </div>
      </div>

      @if (loading()) {
        <p class="status">Loading lab summary data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select a horizon to view lab summary data.</p>
      } @else if (filteredRows().length === 0) {
        <p class="status">No data found for the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Lab summary" tabindex="0">
          <table>
            <thead>
              <tr>
                @for (col of columns; track col.key) {
                  <th [class]="col.type === 'num' ? 'num-h sortable' : 'sortable'"
                      (click)="sort(col.key)">
                    {{ col.label }}
                    <span class="sort-icon">{{ sortIcon(col.key) }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of sortedRows(); track row.fyQuarter + '|' + row.location + '|' + row.sb) {
                <tr>
                  @for (col of columns; track col.key) {
                    <td [class]="col.type === 'num' ? 'num' : ''">
                      @if (col.type === 'num') {
                        {{ getVal(row, col.key) != null ? (getVal(row, col.key) | number:'1.0-2') : '\u2014' }}
                      } @else {
                        {{ getVal(row, col.key) }}
                      }
                    </td>
                  }
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

    .page h2 { margin: 0 0 0.5rem; font-size: 1.4rem; }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: flex-end;
      margin-bottom: 1.25rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem 1.25rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 180px;
    }

    .field label {
      font-weight: 500;
      font-size: 0.82rem;
      color: #374151;
    }

    .field select {
      padding: 0.45rem 0.6rem;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-size: 0.9rem;
      font-family: inherit;
      background: #fff;
    }

    .btn-export {
      font-family: inherit;
      font-size: 0.85rem;
      padding: 0.45rem 0.85rem;
      border-radius: 5px;
      border: 1px solid transparent;
      cursor: pointer;
      background: #ab377a;
      color: #fff;
      white-space: nowrap;
    }
    .btn-export:disabled { opacity: 0.55; cursor: not-allowed; }

    .status { margin-top: 0.75rem; }
    .status-error { color: #b00020; }

    .table-wrap {
      margin-top: 1rem;
      overflow: auto;
      max-height: 70vh;
      border: 1px solid #d9dde3;
      border-radius: 8px;
      background: #fff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 0.5rem 0.65rem;
      border-bottom: 1px solid #edf0f4;
      border-right: 1px solid #f0f0f0;
      text-align: left;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    thead th {
      background: #ab377a;
      color: #fff;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
      border: 1px solid #ffffff;
    }

    .sortable { cursor: pointer; user-select: none; }
    .sortable:hover { background: #933068; }

    .sort-icon { font-style: normal; margin-left: 4px; opacity: 0.85; }

    .num-h { text-align: right; }
    tbody tr:hover { background: #f9fafb; }
    .num { text-align: right; }
  `],
})
export class LabSummary implements OnInit {
  private readonly api = inject(ServiceBundleService);

  readonly columns = COLUMNS;

  protected readonly horizons   = signal<LookupItem[]>([]);
  private  readonly allRows     = signal<LabSummaryRow[]>([]);
  protected readonly loading    = signal(false);
  protected readonly error      = signal<string | null>(null);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedLoc     = signal('');
  protected readonly selectedSb      = signal('');

  protected readonly sortCol = signal<string>('fyQuarter');
  protected readonly sortAsc = signal<boolean>(true);

  protected readonly locOptions = computed((): string[] =>
    [...new Set(this.allRows().map(r => r.location).filter(Boolean))].sort()
  );

  protected readonly sbOptions = computed((): string[] =>
    [...new Set(this.allRows().map(r => r.sb).filter(Boolean))].sort()
  );

  protected readonly filteredRows = computed((): LabSummaryRow[] => {
    const loc = this.selectedLoc();
    const sb  = this.selectedSb();
    return this.allRows().filter(
      r => (!loc || r.location === loc) && (!sb || r.sb === sb)
    );
  });

  protected readonly sortedRows = computed((): LabSummaryRow[] => {
    const col = this.sortCol() as keyof LabSummaryRow;
    const asc = this.sortAsc();
    const rows = [...this.filteredRows()];

    rows.sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number')
        return asc ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });

    return rows;
  });

  protected sort(col: string): void {
    if (this.sortCol() === col) {
      this.sortAsc.set(!this.sortAsc());
    } else {
      this.sortCol.set(col);
      this.sortAsc.set(true);
    }
  }

  protected sortIcon(col: string): string {
    if (this.sortCol() !== col) return '⇅';
    return this.sortAsc() ? '▲' : '▼';
  }

  protected getVal(row: LabSummaryRow, key: keyof LabSummaryRow): string | number | null {
    return row[key] as string | number | null;
  }

  ngOnInit(): void {
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) {
          this.selectedHorizon.set(data[0].value);
          this.loadData();
        }
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.selectedLoc.set('');
    this.selectedSb.set('');
    if (value) {
      this.loadData();
    } else {
      this.allRows.set([]);
    }
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getLabSummary(this.selectedHorizon()).subscribe({
      next: (data) => {
        this.allRows.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load lab summary data.');
      },
    });
  }

  protected exportToExcel(): void {
    const rows = this.sortedRows();
    const header = COLUMNS.map(c => c.label);
    const data = rows.map(row =>
      COLUMNS.map(col => {
        const v = row[col.key];
        if (col.type === 'num') return v != null ? Number(v) : '';
        return v ?? '';
      })
    );

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lab Summary');
    XLSX.writeFile(wb, `lab-summary-${this.selectedHorizon() || 'all'}.xlsx`);
  }
}

