import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import {
  LabCostFilterOptions,
  LabCostRow,
  LookupItem,
  ServiceBundleService,
} from '../../services/service-bundle.service';


/** A pivoted display row: one row per Location+SB, with a value per FY column. */
interface PivotRow {
  location: string;
  sb: string;
  sbname: string;
  values: Record<string, number | null>;
}

@Component({
  selector: 'app-lab-cost',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">

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
            @for (sb of sbOptions(); track sb.value) {
              <option [value]="sb.value">{{ sb.text }}</option>
            }
          </select>
        </div>

        <div class="field" style="justify-content: flex-end; flex-direction: row; gap: 0.5rem; align-items: flex-end;">
          <button class="btn-search" (click)="loadData()" [disabled]="!selectedHorizon() || loading()">
            &#128269; Search
          </button>
          <button class="btn-export" (click)="exportToExcel()" [disabled]="pivotRows().length === 0">
            &#128190; Export to Excel
          </button>
        </div>
      </div>

      @if (loading()) {
        <p class="status">Loading lab cost data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select a horizon and click Search to view lab cost data.</p>
      } @else if (pivotRows().length === 0 && !loading()) {
        <p class="status">Click Search to load data, or no records found for the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Lab cost quarterly average" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col" (click)="sort('location')" class="sortable">
                  Location <span class="sort-icon">{{ sortIcon('location') }}</span>
                </th>
                <th scope="col" (click)="sort('sbname')" class="sortable">
                  Service Bundle <span class="sort-icon">{{ sortIcon('sbname') }}</span>
                </th>
                @for (fy of fyColumns(); track fy) {
                  <th scope="col" class="num-h sortable" (click)="sort(fy)">
                    {{ fy }} <span class="sort-icon">{{ sortIcon(fy) }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of sortedPivotRows(); track row.location + '|' + row.sb) {
                <tr>
                  <td>{{ row.location }}</td>
                  <td>{{ row.sbname }}</td>
                  @for (fy of fyColumns(); track fy) {
                    <td class="num">
                      {{ row.values[fy] != null ? (row.values[fy] | number:'1.0-0') : '\u2014' }}
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

    .btn-search {
      font-family: inherit;
      font-size: 0.85rem;
      padding: 0.45rem 0.85rem;
      border-radius: 5px;
      border: 1px solid #ab377a;
      cursor: pointer;
      background: #fff;
      color: #ab377a;
      white-space: nowrap;
    }
    .btn-search:hover:not(:disabled) { background: #f9eef5; }
    .btn-search:disabled { opacity: 0.55; cursor: not-allowed; }

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
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #edf0f4;
      text-align: left;
      font-size: 0.9rem;
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

    .sortable {
      cursor: pointer;
      user-select: none;
    }
    .sortable:hover { background: #933068; }

    .sort-icon { font-style: normal; margin-left: 4px; opacity: 0.85; }

    .num-h { text-align: right; }
    tbody tr:hover { background: #f9fafb; }
    .num { text-align: right; }
  `],
})
export class LabCost implements OnInit {
  private readonly api = inject(ServiceBundleService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly sbOptions = computed((): LookupItem[] => this.preloadedOptions().sbs);
  protected readonly locOptions = computed((): string[] => this.preloadedOptions().locations);
  private readonly allRows = signal<LabCostRow[]>([]);
  private readonly preloadedOptions = signal<LabCostFilterOptions>({ locations: [], sbs: [] });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedSb = signal('');
  protected readonly selectedLoc = signal('');
  private readonly appliedSb = signal('');
  private readonly appliedLoc = signal('');

  // Sort state
  protected readonly sortCol = signal<string>('location');
  protected readonly sortAsc = signal<boolean>(true);

  /** Unique sorted FY values — become dynamic column headers. */
  protected readonly fyColumns = computed(() =>
    [...new Set(this.allRows().map((r) => r.fy))].sort()
  );

  /**
   * Filtered and pivoted rows: one row per Location+SB, with a value map
   * keyed by FY so each FY column can look up its cell value.
   */
  protected readonly pivotRows = computed((): PivotRow[] => {
    const sb = this.appliedSb();
    const loc = this.appliedLoc();
    const filtered = this.allRows().filter(
      (r) => (!sb || r.sb === sb) && (!loc || r.location === loc)
    );

    const map = new Map<string, PivotRow>();
    for (const r of filtered) {
      const key = `${r.location}||${r.sb}`;
      if (!map.has(key)) {
        map.set(key, {
          location: r.location,
          sb: r.sb,
          sbname: r.sbname || r.sb,
          values: {},
        });
      }
      map.get(key)!.values[r.fy] = r.value;
    }
    // Exclude rows where every FY value is null (no cost data at all)
    return [...map.values()]
      .filter((row) => Object.values(row.values).some((v) => v != null))
      .sort((a, b) => a.location.localeCompare(b.location) || a.sbname.localeCompare(b.sbname));
  });

  /** Pivot rows after applying the current sort column/direction. */
  protected readonly sortedPivotRows = computed((): PivotRow[] => {
    const col = this.sortCol();
    const asc = this.sortAsc();
    const rows = [...this.pivotRows()];

    rows.sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;

      if (col === 'location') {
        av = a.location; bv = b.location;
      } else if (col === 'sbname') {
        av = a.sbname; bv = b.sbname;
      } else {
        av = a.values[col] ?? null;
        bv = b.values[col] ?? null;
        // Nulls last
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
      }
      const cmp = (av as string).localeCompare(bv as string);
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

  ngOnInit(): void {
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) this.selectedHorizon.set(data[0].value);
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
    this.api.getLabCostFilterOptions().subscribe({
      next: (opts) => this.preloadedOptions.set(opts),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
  }

  protected loadData(): void {
    const h = this.selectedHorizon();
    if (!h) return;

    // The lab cost view is keyed on the horizon name (e.g. "26-06"), not the id.
    const horizon = this.horizons().find(x => x.value === h)?.text ?? h;

    // Apply selected filters only when Search is clicked.
    this.appliedSb.set(this.selectedSb());
    this.appliedLoc.set(this.selectedLoc());

    this.loading.set(true);
    this.error.set(null);
    this.api.getLabCostQtrAvg(horizon).subscribe({
      next: (data) => {
        this.allRows.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load lab cost data.');
      },
    });
  }

  protected exportToExcel(): void {
    const fyCols = this.fyColumns();
    const rows = this.sortedPivotRows();

    const header = ['Location', 'Service Bundle', ...fyCols];
    const data = rows.map((row) => [
      row.location,
      row.sbname,
      ...fyCols.map((fy) => (row.values[fy] != null ? Math.round(row.values[fy]!) : '')),
    ]);

    const wsData = [header, ...data];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lab Cost Qtr Avg');

    const horizon = this.selectedHorizon() || 'all';
    XLSX.writeFile(wb, `lab-cost-qtr-avg-${horizon}.xlsx`);
  }
}
