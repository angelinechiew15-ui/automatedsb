import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { CostKeyOverviewRow, CostKeyService } from '../../services/cost-key.service';
import { LookupItem, ServiceBundleService } from '../../services/service-bundle.service';

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
     
      <div class="toolbar">
        <div class="field">
          <label for="horizon-filter">Horizon</label>
          <select id="horizon-filter" [ngModel]="selectedHorizon()" (ngModelChange)="onHorizonChange($event)">
            <option value="">-- Select Horizon --</option>
            @for (horizon of horizons(); track horizon.text) {
              <option [value]="horizon.text">{{ horizon.text }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="fy-filter">FY</label>
          <select id="fy-filter" [ngModel]="selectedFy()" (ngModelChange)="onFyChange($event)">
            <option value="">All</option>
            @for (fy of fyOptions(); track fy) {
              <option [value]="fy">{{ fy }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="loc-filter">Location</label>
          <select id="loc-filter" [ngModel]="selectedLoc()" (ngModelChange)="onLocChange($event)">
            <option value="">All</option>
            @for (loc of locOptions(); track loc) {
              <option [value]="loc">{{ loc }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="sb-filter">Service Bundle</label>
          <select id="sb-filter" [ngModel]="selectedSb()" (ngModelChange)="onSbChange($event)">
            <option value="">All</option>
            @for (sb of sbOptions(); track sb) {
              <option [value]="sb">{{ sb }}</option>
            }
          </select>
        </div>
        <button class="btn-refresh" type="button" (click)="loadData()" [disabled]="loading() || !selectedHorizon()">
          {{ loading() ? 'Searching...' : 'Search overview' }}
        </button>
        <button class="btn-export" type="button" (click)="exportToExcel()" [disabled]="filteredRows().length === 0">
          Export to Excel
        </button>
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
      } @else if (!hasSearched()) {
        <p class="status">Select filters and click Search overview to load data.</p>
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
                <th scope="col" class="num-h">PL key</th>
                <th scope="col" class="num-h">Key</th>
                <th scope="col" class="num-h">Cost (K Eur)</th>
                <th scope="col" class="num-h">Calculated Cost - {{ selectedHorizon() }}</th>
                <th scope="col" class="num-h">Cost RFC Demand - {{ selectedHorizon() }}</th>
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
                  <td class="num">{{ formatKey(tableKeyForRow(row)) }}</td>
                  <td class="num">{{ formatAmount(costKeyForRow(row)) }}</td>
                  <td class="num">{{ formatAmount(calculatedCostForHorizon(row, selectedHorizon())) }}</td>
                  <td class="num">{{ formatAmount(costDemandForHorizon(row, selectedHorizon())) }}</td>
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

    .btn-export {
      border: 1px solid transparent;
      background: #8b2f62;
      color: #fff;
      padding: 0.5rem 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }

    .btn-export:disabled {
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
  private readonly bundleApi = inject(ServiceBundleService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly rows = signal<CostKeyOverviewRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasSearched = signal(false);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedFy = signal('');
  protected readonly selectedLoc = signal('');
  protected readonly selectedSb = signal('');

  protected readonly fyOptions = computed(() => [...new Set(this.rows().map((row) => row.fy).filter(Boolean))].sort());
  protected readonly locOptions = computed(() => [...new Set(this.rows().map((row) => row.loc).filter(Boolean))].sort());
  protected readonly sbOptions = computed(() => [...new Set(this.rows().map((row) => row.serviceBundle).filter(Boolean))].sort());

  protected readonly filteredRows = computed(() => {
    // Derive the expected FY from the selected horizon: 26-xx → "25/26", 25-xx → "24/25", etc.
    // An explicit FY dropdown selection overrides the derived default.
    const horizonFy = this.deriveFyFromHorizon(this.selectedHorizon());
    const fy = this.selectedFy() || horizonFy;
    const loc = this.selectedLoc();
    const sb = this.selectedSb();

    return this.rows()
      .filter(
        (row) =>
          this.hasAnyCostDemandAcrossSelectedAndPastHorizons(row) &&
          (!fy || row.fy === fy) &&
          (!loc || row.loc === loc) &&
          (!sb || row.serviceBundle === sb),
      )
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

        const bySb = a.serviceBundle.localeCompare(b.serviceBundle);
        if (bySb !== 0) {
          return bySb;
        }

        const byCorridor = a.clientCorridor.localeCompare(b.clientCorridor);
        if (byCorridor !== 0) {
          return byCorridor;
        }

        return a.wbsElement.localeCompare(b.wbsElement);
      });
  });

  private hasAnyCostDemandAcrossSelectedAndPastHorizons(row: CostKeyOverviewRow): boolean {
    if (row.costKeur != null && !Number.isNaN(row.costKeur) && row.costKeur > 0) {
      return true;
    }

    for (const value of Object.values(row.historicalCosts ?? {})) {
      if (value != null && !Number.isNaN(value) && value > 0) {
        return true;
      }
    }

    return false;
  }

  protected readonly demandByGroupAndHorizon = computed(() => {
    const rows = this.filteredRows();
    const selected = this.selectedHorizon().trim();
    const horizons = this.requiredHorizonsForSelected(selected);

    const grouped = new Map<string, CostKeyOverviewRow[]>();
    for (const row of rows) {
      const key = this.groupKey(row);
      const existing = grouped.get(key);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }

    const result = new Map<string, Map<string, number | null>>();
    for (const [groupKey, groupRows] of grouped) {
      const perHorizon = new Map<string, number | null>();

      for (const horizon of horizons) {
        if (horizon === selected) {
          const current = groupRows.reduce((sum, row) => sum + (row.costKeur ?? 0), 0);
          perHorizon.set(horizon, current);
          continue;
        }

        perHorizon.set(horizon, this.groupHistoricalCost(groupRows, horizon));
      }

      result.set(groupKey, perHorizon);
    }

    return result;
  });

  protected readonly calculatedCostByGroup = computed(() => {
    const selected = this.selectedHorizon().trim();
    const demandMaps = this.demandByGroupAndHorizon();
    const result = new Map<string, number | null>();

    for (const [groupKey, demandByHorizon] of demandMaps) {
      result.set(groupKey, this.calculateCostForHorizon(selected, demandByHorizon));
    }

    return result;
  });

  protected readonly calculatedRowCostByRow = computed(() => {
    const rows = this.filteredRows();
    const costByGroup = this.calculatedCostByGroup();
    const result = new Map<string, number | null>();

    for (const row of rows) {
      const groupCost = costByGroup.get(this.groupKey(row));
      if (groupCost == null || Number.isNaN(groupCost)) {
        result.set(this.rowKey(row), null);
        continue;
      }

      result.set(this.rowKey(row), groupCost * (row.ccPercent ?? 0));
    }

    return result;
  });

  protected readonly tableKeyByRow = computed(() => {
    const rows = this.filteredRows();
    const totalCostKeur = rows.reduce((sum, row) => {
      const costKeur = this.costKeyForRow(row);
      return sum + (costKeur == null || Number.isNaN(costKeur) ? 0 : costKeur);
    }, 0);

    const result = new Map<string, number | null>();
    for (const row of rows) {
      const rowCostKeur = this.costKeyForRow(row);
      if (rowCostKeur == null || Number.isNaN(rowCostKeur) || totalCostKeur <= 0) {
        result.set(this.rowKey(row), null);
      } else {
        result.set(this.rowKey(row), rowCostKeur / totalCostKeur);
      }
    }

    return result;
  });

  protected readonly calculatedKeyByRow = computed(() => {
    const rows = this.filteredRows();
    const rowCosts = this.calculatedRowCostByRow();
    const result = new Map<string, number | null>();

    const partitions = new Map<string, number>();
    for (const row of rows) {
      const partition = this.partitionKey(row);
      const rowCost = rowCosts.get(this.rowKey(row));
      if (rowCost == null || Number.isNaN(rowCost)) {
        continue;
      }

      partitions.set(partition, (partitions.get(partition) ?? 0) + rowCost);
    }

    for (const row of rows) {
      const rowId = this.rowKey(row);
      const partition = this.partitionKey(row);
      const numerator = rowCosts.get(rowId);
      const denominator = partitions.get(partition) ?? 0;

      if (numerator == null || Number.isNaN(numerator) || denominator <= 0) {
        result.set(rowId, null);
      } else {
        result.set(rowId, numerator / denominator);
      }
    }

    return result;
  });

  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    // Total Cost RFC Demand sums costKeur for the selected horizon (FY) + location
    // across ALL service bundles, so the card reflects the full location total.
    const horizonFy = this.deriveFyFromHorizon(this.selectedHorizon());
    const loc = this.selectedLoc();
    const totalRfcDemand = this.rows()
      .filter((row) => (!horizonFy || row.fy === horizonFy) && (!loc || row.loc === loc))
      .reduce((sum, row) => sum + (row.costKeur ?? 0), 0);

    const totalCostKeur = this.filteredRows().reduce((sum, row) => {
      const value = this.costKeyForRow(row);
      return sum + (value == null || Number.isNaN(value) ? 0 : value);
    }, 0);

    return [
      { label: 'Selected Horizon', value: this.selectedHorizon() || 'All' },
      { label: 'Selected Location', value: this.selectedLoc() || 'All' },
      { label: 'Total Cost RFC Demand (k EUR)', value: this.formatAmount(totalRfcDemand) },
      { label: 'Total Cost (k EUR)', value: this.formatAmount(totalCostKeur) },
    ];
  });

  ngOnInit(): void {
    this.bundleApi.listHorizons().subscribe({
      next: (data) => {
        const horizons = data ?? [];
        this.horizons.set(horizons);
        const latest = this.findLatestHorizon(horizons);
        this.selectedHorizon.set(latest);
      },
      error: () => {
        this.error.set('Failed to load horizons.');
      },
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.loadData();
  }

  protected onFyChange(value: string): void {
    this.selectedFy.set(value);
  }

  protected onLocChange(value: string): void {
    this.selectedLoc.set(value);
  }

  protected onSbChange(value: string): void {
    this.selectedSb.set(value);
  }

  protected loadData(): void {
    const horizon = this.selectedHorizon();
    if (!horizon) {
      return;
    }

    this.hasSearched.set(true);
    this.loading.set(true);
    this.error.set(null);

    this.api.getOverview(horizon, this.selectedFy(), this.selectedLoc(), this.selectedSb()).subscribe({
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

  protected exportToExcel(): void {
    const rows = this.filteredRows();
    if (!rows.length) {
      return;
    }

    const wsData: (string | number)[][] = [
      ['Location', 'Service Bundle', 'Client Corridor', 'WBS Element', 'PL Key', 'Key', 'Cost (K Eur)', `Calculated Cost - ${this.selectedHorizon()}`, `Cost RFC Demand - ${this.selectedHorizon()}`],
    ];

    for (const row of rows) {
      const calculatedCost = this.calculatedCostForHorizon(row, this.selectedHorizon());
      const costRfcDemand = this.costDemandForHorizon(row, this.selectedHorizon());
      const costKeur = this.costKeyForRow(row);
      const key = this.tableKeyForRow(row);
      wsData.push([
        row.loc,
        row.serviceBundle,
        row.clientCorridor || '-',
        row.wbsElement || '-',
        row.ccPercent ?? 0,
        key ?? 0,
        costKeur ?? 0,
        calculatedCost ?? 0,
        costRfcDemand ?? 0,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 28 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
    ];

    const rowCount = rows.length + 1;
    for (let r = 2; r <= rowCount; r++) {
      ws[`E${r}`].z = '0.00%';
      ws[`F${r}`].z = '0.00%';
      ws[`G${r}`].z = '#,##0.00';
      ws[`H${r}`].z = '#,##0.00';
      ws[`I${r}`].z = '#,##0.00';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Key');

    const horizon = this.selectedHorizon() || 'no-horizon';
    XLSX.writeFile(wb, `cost-key-${horizon}.xlsx`);
  }

  private findLatestHorizon(horizons: LookupItem[]): string {
    return horizons
      .map((item) => item?.text?.trim())
      .filter((text): text is string => !!text)
      .sort((left, right) => this.compareHorizon(left, right))
      .at(-1) ?? '';
  }

  private compareHorizon(left: string, right: string): number {
    const leftParsed = this.parseHorizon(left);
    const rightParsed = this.parseHorizon(right);

    if (leftParsed && rightParsed) {
      if (leftParsed.year !== rightParsed.year) {
        return leftParsed.year - rightParsed.year;
      }
      if (leftParsed.period !== rightParsed.period) {
        return leftParsed.period - rightParsed.period;
      }
    }

    return left.localeCompare(right, undefined, { numeric: true });
  }

  private parseHorizon(value: string): { year: number; period: number } | null {
    const match = /^(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }
    return {
      year: Number.parseInt(match[1], 10),
      period: Number.parseInt(match[2], 10),
    };
  }

  private requiredHorizonsForSelected(selected: string): string[] {
    if (!selected) {
      return [];
    }

    const parsed = this.parseHorizon(selected);
    if (!parsed) {
      return [selected];
    }

    if (parsed.period === 9) {
      return [selected];
    }

    if (parsed.period === 12) {
      const prev1 = this.previousHorizon(selected, 1);
      return prev1 ? [selected, prev1] : [selected];
    }

    if (parsed.period === 3) {
      const prev1 = this.previousHorizon(selected, 1);
      const prev2 = this.previousHorizon(selected, 2);
      return [selected, prev1, prev2].filter((value): value is string => !!value);
    }

    if (parsed.period === 6) {
      const prev1 = this.previousHorizon(selected, 1);
      const prev2 = this.previousHorizon(selected, 2);
      const prev3 = this.previousHorizon(selected, 3);
      return [selected, prev1, prev2, prev3].filter((value): value is string => !!value);
    }

    return [selected];
  }

  /**
   * Derives the expected current-FY string from a horizon code.
   * Horizon "26-xx" → "25/26", "25-xx" → "24/25", "27-xx" → "26/27", etc.
   * Returns null when the horizon cannot be parsed.
   */
  private deriveFyFromHorizon(horizon: string): string | null {
    const match = /^(\d{2})-\d{2}$/.exec(horizon.trim());
    if (!match) return null;
    const yr = parseInt(match[1], 10);
    const prev = ((yr - 1 + 100) % 100).toString().padStart(2, '0');
    return `${prev}/${match[1]}`;
  }

  private previousHorizon(horizon: string, steps: number): string | null {
    const parsed = this.parseHorizon(horizon);
    if (!parsed || steps <= 0) {
      return null;
    }

    let year = parsed.year;
    let period = parsed.period;

    for (let step = 0; step < steps; step++) {
      if (period === 3) {
        period = 12;
        year = (year + 99) % 100;
      } else if (period === 6) {
        period = 3;
      } else if (period === 9) {
        period = 6;
      } else if (period === 12) {
        period = 9;
      } else {
        return null;
      }
    }

    return `${year.toString().padStart(2, '0')}-${period.toString().padStart(2, '0')}`;
  }

  private groupHistoricalCost(rows: CostKeyOverviewRow[], horizon: string | null): number | null {
    if (!horizon) {
      return null;
    }

    let sum = 0;
    let foundAny = false;

    for (const row of rows) {
      const value = row.historicalCosts[horizon];
      if (value == null || Number.isNaN(value)) {
        continue;
      }

      sum += value;
      foundAny = true;
    }

    return foundAny ? sum : 0;
  }

  private calculateCostForHorizon(horizon: string, demandByHorizon: Map<string, number | null>): number | null {
    const demandCurrent = demandByHorizon.get(horizon);
    if (demandCurrent == null || Number.isNaN(demandCurrent)) {
      return null;
    }

    const parsed = this.parseHorizon(horizon);
    if (!parsed) {
      return null;
    }

    if (parsed.period === 9) {
      // xx-09: Calculated = Cost RFC Demand.
      return demandCurrent;
    }

    const prev1 = this.previousHorizon(horizon, 1);
    const demandPrev1 = prev1 ? this.zeroIfNull(demandByHorizon.get(prev1)) : 0;

    if (parsed.period === 12) {
      // xx-12 = [(Dxx12*12) - (Dprev1*3)] / 9
      return ((demandCurrent * 12) - (demandPrev1 * 3)) / 9;
    }

    const prev2 = this.previousHorizon(horizon, 2);
    const demandPrev2 = prev2 ? this.zeroIfNull(demandByHorizon.get(prev2)) : 0;

    if (parsed.period === 3) {
      // xx-03 = [(Dxx03*12) - (Dprev1*3) - (Dprev2*3)] / 6
      return ((demandCurrent * 12) - (demandPrev1 * 3) - (demandPrev2 * 3)) / 6;
    }

    const prev3 = this.previousHorizon(horizon, 3);
    const demandPrev3 = prev3 ? this.zeroIfNull(demandByHorizon.get(prev3)) : 0;

    if (parsed.period === 6) {
      // xx-06 = [(Dxx06*12) - (Dprev1*3) - (Dprev2*3) - (Dprev3*3)] / 3
      return ((demandCurrent * 12) - (demandPrev1 * 3) - (demandPrev2 * 3) - (demandPrev3 * 3)) / 3;
    }

    return null;
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

  protected calculatedCost(row: CostKeyOverviewRow): number | null {
    return this.normalizedCalculatedCost(this.calculatedCostByGroup().get(this.groupKey(row)));
  }

  protected costDemandForHorizon(row: CostKeyOverviewRow, horizon: string): number | null {
    const value = this.demandByGroupAndHorizon().get(this.groupKey(row))?.get(horizon);
    return value == null || Number.isNaN(value) ? null : value;
  }

  protected calculatedCostForHorizon(row: CostKeyOverviewRow, horizon: string): number | null {
    if (!horizon || horizon !== this.selectedHorizon()) {
      return null;
    }

    return this.normalizedCalculatedCost(this.calculatedCostByGroup().get(this.groupKey(row)));
  }

  protected costKeyForRow(row: CostKeyOverviewRow): number | null {
    const calculatedCost = this.calculatedCostForHorizon(row, this.selectedHorizon());
    const plKey = row.ccPercent;

    if (calculatedCost == null || Number.isNaN(calculatedCost) || plKey == null || Number.isNaN(plKey)) {
      return null;
    }

    return calculatedCost * plKey;
  }

  protected tableKeyForRow(row: CostKeyOverviewRow): number | null {
    const value = this.tableKeyByRow().get(this.rowKey(row));
    return value == null || Number.isNaN(value) ? null : value;
  }

  protected calculatedRowCost(row: CostKeyOverviewRow): number | null {
    const value = this.calculatedRowCostByRow().get(this.rowKey(row));
    return value == null || Number.isNaN(value) ? null : value;
  }

  protected calculatedKey(row: CostKeyOverviewRow): number | null {
    const value = this.calculatedKeyByRow().get(this.rowKey(row));
    return value == null || Number.isNaN(value) ? null : value;
  }

  // Key derived from direct costKeur values (not the annualisation formula).
  // Numerator  = row.costKeur
  // Denominator = sum of costKeur for all filteredRows with the same (fy, loc).
  protected readonly costKeurKeyByRow = computed(() => {
    const rows = this.filteredRows();
    const partitions = new Map<string, number>();
    for (const row of rows) {
      const p = this.partitionKey(row);
      partitions.set(p, (partitions.get(p) ?? 0) + (row.costKeur ?? 0));
    }
    const result = new Map<string, number | null>();
    for (const row of rows) {
      const denom = partitions.get(this.partitionKey(row)) ?? 0;
      result.set(this.rowKey(row), denom > 0 ? (row.costKeur ?? 0) / denom : null);
    }
    return result;
  });

  protected costKeurKey(row: CostKeyOverviewRow): number | null {
    const value = this.costKeurKeyByRow().get(this.rowKey(row));
    return value == null || Number.isNaN(value) ? null : value;
  }

  private groupKey(row: CostKeyOverviewRow): string {
    return `${row.fy}|${row.loc}|${row.serviceBundle}`;
  }

  private partitionKey(row: CostKeyOverviewRow): string {
    return `${row.fy}|${row.loc}`;
  }

  private rowKey(row: CostKeyOverviewRow): string {
    return `${row.fy}|${row.loc}|${row.serviceBundle}|${row.clientCorridor}|${row.wbsElement}`;
  }

  protected formatCount(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  private zeroIfNull(value: number | null | undefined): number {
    return value == null || Number.isNaN(value) ? 0 : value;
  }

  private normalizedCalculatedCost(value: number | null | undefined): number | null {
    if (value == null || Number.isNaN(value)) {
      return null;
    }

    return Math.max(0, value);
  }
}
