import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LabCostRow,
  LookupItem,
  ServiceBundleService,
} from '../../services/service-bundle.service';
import { AdminService } from '../../services/admin.service';

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
      <h2>Lab Cost</h2>

      <div class="filters">
        <label>
          Horizon
          <select [ngModel]="selectedHorizon()" (ngModelChange)="onHorizonChange($event)">
            <option value="">-- Select Horizon --</option>
            @for (h of horizons(); track h.value) {
              <option [value]="h.value">{{ h.text }}</option>
            }
          </select>
        </label>

        <label>
          SB
          <select [ngModel]="selectedSb()" (ngModelChange)="selectedSb.set($event)">
            <option value="">All</option>
            @for (sb of sbOptions(); track sb.value) {
              <option [value]="sb.value">{{ sb.text }}</option>
            }
          </select>
        </label>

        <label>
          Location
          <select [ngModel]="selectedLoc()" (ngModelChange)="selectedLoc.set($event)">
            <option value="">All</option>
            @for (loc of locOptions(); track loc) {
              <option [value]="loc">{{ loc }}</option>
            }
          </select>
        </label>
      </div>

      @if (loading()) {
        <p class="status">Loading lab cost data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select a horizon to view lab cost data.</p>
      } @else if (pivotRows().length === 0) {
        <p class="status">No lab cost data found for the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Lab cost quarterly average" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">SB</th>
                @for (fy of fyColumns(); track fy) {
                  <th scope="col" class="num-h">{{ fy }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of pivotRows(); track row.location + '|' + row.sb) {
                <tr>
                  <td>{{ row.location }}</td>
                  <td>{{ row.sbname }}</td>
                  @for (fy of fyColumns(); track fy) {
                    <td class="num">
                      {{ row.values[fy] != null ? (row.values[fy] | number:'1.0-2') : '\u2014' }}
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
    .page { padding: 1.5rem 1.5rem 1.5rem 3rem; }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .filters label {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      font-weight: 600;
      gap: 0.25rem;
    }
    .filters select {
      font-size: 0.9rem;
      padding: 0.35rem 0.5rem;
      border: 1px solid #c0c7d1;
      border-radius: 4px;
      min-width: 180px;
    }

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
      background: #f4f6f9;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .num-h { text-align: right; }
    tbody tr:hover { background: #f9fafb; }
    .num { text-align: right; }
  `],
})
export class LabCost implements OnInit {
  private readonly api = inject(ServiceBundleService);
  private readonly adminApi = inject(AdminService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly sbOptions = signal<LookupItem[]>([]);
  protected readonly locOptions = signal<string[]>([]);
  private readonly allRows = signal<LabCostRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedSb = signal('');
  protected readonly selectedLoc = signal('');

  /** Unique sorted FY values — become dynamic column headers. */
  protected readonly fyColumns = computed(() =>
    [...new Set(this.allRows().map((r) => r.fy))].sort()
  );

  /**
   * Filtered and pivoted rows: one row per Location+SB, with a value map
   * keyed by FY so each FY column can look up its cell value.
   */
  protected readonly pivotRows = computed((): PivotRow[] => {
    const sb = this.selectedSb();
    const loc = this.selectedLoc();
    const sbMap = new Map(this.sbOptions().map((o) => [o.value, o.text]));
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
          sbname: sbMap.get(r.sb) ?? r.sb,
          values: {},
        });
      }
      map.get(key)!.values[r.fy] = r.value;
    }
    return [...map.values()].sort((a, b) =>
      a.location.localeCompare(b.location) || a.sbname.localeCompare(b.sbname)
    );
  });

  ngOnInit(): void {
    // Load all three filter dropdowns in parallel from existing endpoints.
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

    this.adminApi.listSb().subscribe({
      next: (rows) => {
        const seen = new Set<string>();
        const sbs: LookupItem[] = [];
        for (const r of rows.sort((a, b) => a.sbname.localeCompare(b.sbname))) {
          if (!seen.has(r.sb)) {
            seen.add(r.sb);
            sbs.push({ value: r.sb, text: r.sbname });
          }
        }
        this.sbOptions.set(sbs);
      },
      error: () => {}, // non-critical: dropdown stays empty
    });

    this.adminApi.listSbol().subscribe({
      next: (rows) => {
        const locs = [...new Set(rows.map((r) => r.rptloc).filter(Boolean))].sort();
        this.locOptions.set(locs);
      },
      error: () => {}, // non-critical: dropdown stays empty
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.selectedSb.set('');
    this.selectedLoc.set('');
    if (value) {
      this.loadData();
    } else {
      this.allRows.set([]);
    }
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getLabCostQtrAvg(this.selectedHorizon()).subscribe({
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
}
