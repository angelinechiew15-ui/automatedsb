import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { LabSummaryFilterOptions, LabSummaryRow, LookupItem, ServiceBundleService } from '../../services/service-bundle.service';

/** The 15 measure columns — defines order and labels for both headers and export. */
const MEASURES: { key: keyof LabSummaryRow; label: string }[] = [
  { key: 'tsDemand',      label: 'TSpM RFC Demand'           },
  { key: 'adderTs',       label: 'Adder Value TS Demand'     },
  { key: 'tsActual',      label: 'TSpM Actual'               },
  { key: 'changeTs',      label: 'Adder Value TS Actual'     },
  { key: 'rtuRfcDemand',  label: 'RTU RFC Demand'            },
  { key: 'adderRtu',      label: 'Adder Value RTU Demand'    },
  { key: 'rtuTs',         label: 'RTU/TS'                    },
  { key: 'rtuActual',     label: 'RTU Actual'                },
  { key: 'changeRtu',     label: 'Adder Value RTU Actual'    },
  { key: 'costRfcWoDepr', label: 'Cost RFC w/o Depreciation' },
  { key: 'depreciation',  label: 'Cost RFC Depreciation'     },
  { key: 'costRfcDemand', label: 'Cost RFC Demand'           },
  { key: 'adderCost',     label: 'Adder Value Cost Demand'   },
  { key: 'costRtu',       label: 'Cost/RTU'                  },
  { key: 'costActual',    label: 'Cost Actual'               },
];

/** A pivot row keyed by (horizon, sb). Cells are keyed by "fyQuarter||location||measureKey". */
interface PivotRow {
  horizon: string;
  sb: string;
  cells: Record<string, number | null>;
}

@Component({
  selector: 'app-lab-summary',
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
          <label>FY Quarter</label>
          <select [ngModel]="selectedFyQuarter()" (ngModelChange)="selectedFyQuarter.set($event)">
            <option value="">All</option>
            @for (q of fyQuarterOptions(); track q) {
              <option [value]="q">{{ q }}</option>
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

        <div class="field" style="justify-content: flex-end; flex-direction: row; gap: 0.5rem; align-items: flex-end;">
          <button class="btn-refresh" (click)="refresh()" [disabled]="!selectedHorizon() || loading()">
            &#8635; Refresh
          </button>
          <button class="btn-export" (click)="exportToExcel()" [disabled]="pivotRows().length === 0">
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
      } @else if (pivotRows().length === 0 && !loading()) {
        <p class="status">Click Refresh to load data, or no records found for the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Lab summary pivot" tabindex="0">
          <table>
            <thead>
              <!-- Row 1: fixed-col stubs (rowspan 3) + FY Quarter groups -->
              <tr>
                <th rowspan="3" class="fz fz1 sortable" (click)="sort('horizon')">
                  Horizon <span class="si">{{ sortIcon('horizon') }}</span>
                </th>
                <th rowspan="3" class="fz fz2 sortable" (click)="sort('sb')">
                  SB <span class="si">{{ sortIcon('sb') }}</span>
                </th>
                @for (qg of quarterGroups(); track qg.fyQuarter) {
                  <th [attr.colspan]="qg.span" class="grp-h">{{ qg.fyQuarter }}</th>
                }
              </tr>
              <!-- Row 2: Location groups -->
              <tr>
                @for (lg of locationGroups(); track lg.fyQuarter + lg.location) {
                  <th [attr.colspan]="measuresCount" class="grp-h">{{ lg.location }}</th>
                }
              </tr>
              <!-- Row 3: Measure columns -->
              <tr>
                @for (mc of measureCols(); track mc.colKey) {
                  <th class="num-h measure-h sortable" (click)="sort(mc.colKey)">
                    {{ mc.label }} <span class="si">{{ sortIcon(mc.colKey) }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of sortedPivotRows(); track row.horizon + '|' + row.sb) {
                <tr>
                  <td class="fz fz1">{{ row.horizon }}</td>
                  <td class="fz fz2">{{ row.sb }}</td>
                  @for (mc of measureCols(); track mc.colKey) {
                    <td class="num">
                      {{ row.cells[mc.colKey] != null ? (row.cells[mc.colKey] | number:'1.0-2') : '\u2014' }}
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
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;
      margin-bottom: 1.25rem; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 180px; }
    .field label { font-weight: 500; font-size: 0.82rem; color: #374151; }
    .field select {
      padding: 0.45rem 0.6rem; border: 1px solid #d1d5db; border-radius: 5px;
      font-size: 0.9rem; font-family: inherit; background: #fff;
    }

    .btn-export {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid transparent; cursor: pointer;
      background: #ab377a; color: #fff; white-space: nowrap;
    }
    .btn-export:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-refresh {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid #ab377a; cursor: pointer;
      background: #fff; color: #ab377a; white-space: nowrap;
    }
    .btn-refresh:hover:not(:disabled) { background: #f9eef5; }
    .btn-refresh:disabled { opacity: 0.55; cursor: not-allowed; }

    .status { margin-top: 0.75rem; }
    .status-error { color: #b00020; }

    .table-wrap {
      margin-top: 1rem; overflow: auto; max-height: 70vh;
      border: 1px solid #d9dde3; border-radius: 8px; background: #fff;
    }

    table { border-collapse: collapse; }

    th, td {
      padding: 0.45rem 0.55rem;
      border: 1px solid #e5e7eb;
      text-align: left; font-size: 0.82rem; white-space: nowrap;
    }

    /* Sticky column headers (rows 1-3) */
    thead th {
      background: #ab377a; color: #fff; font-weight: 600;
      position: sticky; top: 0; z-index: 1;
    }

    /* Group headers (FY Quarter and Location rows) */
    .grp-h { text-align: center; background: #7b2257; }

    /* Measure header (bottom header row) */
    .measure-h { background: #ab377a; font-size: 0.78rem; }

    /* Frozen row-key columns */
    .fz  { position: sticky; z-index: 2; background: #fff; }
    .fz1 { left: 0;     min-width: 90px;  max-width: 90px;  }
    .fz2 { left: 90px;  min-width: 200px; max-width: 200px; }

    thead .fz { background: #ab377a; z-index: 4; }
    tbody tr:hover .fz { background: #f9fafb; }

    .sortable { cursor: pointer; user-select: none; }
    thead .sortable:hover { background: #933068; }
    .si { font-style: normal; margin-left: 3px; opacity: 0.85; }

    .num-h { text-align: right; }
    tbody tr:hover { background: #f9fafb; }
    .num { text-align: right; }
  `],
})
export class LabSummary implements OnInit {
  private readonly api = inject(ServiceBundleService);

  protected readonly measuresCount = MEASURES.length;

  protected readonly horizons = signal<LookupItem[]>([]);
  private  readonly allRows   = signal<LabSummaryRow[]>([]);
  private  readonly preloadedOptions = signal<LabSummaryFilterOptions>({ fyQuarters: [], locations: [], sbs: [] });
  protected readonly loading  = signal(false);
  protected readonly error    = signal<string | null>(null);

  protected readonly selectedHorizon  = signal('');
  protected readonly selectedSb       = signal('');
  protected readonly selectedLoc      = signal('');
  protected readonly selectedFyQuarter = signal('');

  protected readonly sortCol = signal<string>('sb');
  protected readonly sortAsc = signal<boolean>(true);

  // ── Filter options ──────────────────────────────────────────────────────────

  protected readonly fyQuarterOptions = computed((): string[] =>
    this.allRows().length
      ? [...new Set(this.allRows().map(r => r.fyQuarter).filter(Boolean))].sort()
      : this.preloadedOptions().fyQuarters
  );

  protected readonly hasData = computed(() => this.allRows().length > 0);

  protected readonly locOptions = computed((): string[] =>
    this.allRows().length
      ? [...new Set(this.allRows().map(r => r.location).filter(Boolean))].sort()
      : this.preloadedOptions().locations
  );

  protected readonly sbOptions = computed((): string[] =>
    this.allRows().length
      ? [...new Set(this.allRows().map(r => r.sb).filter(Boolean))].sort()
      : this.preloadedOptions().sbs
  );

  // ── Active column locations (respects Location filter) ─────────────────────

  private readonly activeLocations = computed((): string[] => {
    const sel = this.selectedLoc();
    const all = this.locOptions();
    return sel ? all.filter(l => l === sel) : all;
  });

  // ── Column structure (3-level headers) ─────────────────────────────────────

  private readonly fyQuarters = computed((): string[] => {
    const sel = this.selectedFyQuarter();
    const all = [...new Set(this.allRows().map(r => r.fyQuarter))].sort();
    return sel ? all.filter(q => q === sel) : all;
  });

  protected readonly quarterGroups = computed(() =>
    this.fyQuarters().map(fy => ({
      fyQuarter: fy,
      span: this.activeLocations().length * MEASURES.length,
    }))
  );

  protected readonly locationGroups = computed(() => {
    const groups: { fyQuarter: string; location: string }[] = [];
    for (const fy of this.fyQuarters()) {
      for (const loc of this.activeLocations()) {
        groups.push({ fyQuarter: fy, location: loc });
      }
    }
    return groups;
  });

  protected readonly measureCols = computed(() => {
    const cols: { fyQuarter: string; location: string; key: keyof LabSummaryRow; label: string; colKey: string }[] = [];
    for (const fy of this.fyQuarters()) {
      for (const loc of this.activeLocations()) {
        for (const m of MEASURES) {
          cols.push({ fyQuarter: fy, location: loc, key: m.key, label: m.label, colKey: `${fy}||${loc}||${m.key}` });
        }
      }
    }
    return cols;
  });

  // ── Pivot rows: group by (horizon, sb) ──────────────────────────────────────

  protected readonly pivotRows = computed((): PivotRow[] => {
    const sbFilter  = this.selectedSb();
    const qFilter   = this.selectedFyQuarter();
    const filtered  = this.allRows().filter(r =>
      (!sbFilter || r.sb === sbFilter) &&
      (!qFilter  || r.fyQuarter === qFilter)
    );

    const map = new Map<string, PivotRow>();
    for (const r of filtered) {
      const rowKey = `${r.horizon}||${r.sb}`;
      if (!map.has(rowKey)) {
        map.set(rowKey, { horizon: r.horizon, sb: r.sb, cells: {} });
      }
      const pivot = map.get(rowKey)!;
      for (const m of MEASURES) {
        pivot.cells[`${r.fyQuarter}||${r.location}||${m.key}`] =
          r[m.key] as number | null;
      }
    }
    return [...map.values()].sort((a, b) =>
      a.horizon.localeCompare(b.horizon) || a.sb.localeCompare(b.sb)
    );
  });

  protected readonly sortedPivotRows = computed((): PivotRow[] => {
    const col = this.sortCol();
    const asc = this.sortAsc();
    const rows = [...this.pivotRows()];

    rows.sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;

      if (col === 'horizon')      { av = a.horizon; bv = b.horizon; }
      else if (col === 'sb')      { av = a.sb;      bv = b.sb;      }
      else {
        av = a.cells[col] ?? null;
        bv = b.cells[col] ?? null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
      }
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

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Load horizons and filter options together on tab open — once only
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) {
          this.selectedHorizon.set(data[0].value);
        }
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    this.api.getLabSummaryFilterOptions().subscribe({
      next: (opts) => this.preloadedOptions.set(opts),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.selectedSb.set('');
    this.selectedLoc.set('');
    this.selectedFyQuarter.set('');
    this.allRows.set([]);
  }

  protected refresh(): void {
    if (this.selectedHorizon()) {
      this.loadData();
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

  // ── Export ──────────────────────────────────────────────────────────────────

  protected exportToExcel(): void {
    const mCols  = this.measureCols();
    const rows   = this.sortedPivotRows();

    // 3-row header matching the pivot structure
    const hRow1 = ['Horizon', 'SB', ...mCols.map(c => c.fyQuarter)];
    const hRow2 = ['',        '',   ...mCols.map(c => c.location)];
    const hRow3 = ['',        '',   ...mCols.map(c => c.label)];

    const data = rows.map(row => [
      row.horizon,
      row.sb,
      ...mCols.map(mc => {
        const v = row.cells[mc.colKey];
        return v != null ? v : '';
      }),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([hRow1, hRow2, hRow3, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lab Summary');
    XLSX.writeFile(wb, `lab-summary-${this.selectedHorizon() || 'all'}.xlsx`);
  }
}

