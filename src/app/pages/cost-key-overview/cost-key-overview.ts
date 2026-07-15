import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { LookupItem, ServiceBundleService } from '../../services/service-bundle.service';
import { CostKeyOverviewRow, CostKeyService } from '../../services/cost-key.service';

interface SummaryCard {
  label: string;
  value: string;
}

@Component({
  selector: 'app-cost-key-overview',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

        <button class="btn-refresh" type="button" (click)="loadData()" [disabled]="loading() || !selectedHorizon()">
          {{ loading() ? 'Refreshing...' : 'Refresh overview' }}
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
                @for (horizon of calculationPastHorizons(); track horizon) {
                  <th scope="col" class="num-h">Calculated Cost - {{ horizon }}</th>
                  <th scope="col" class="num-h">Cost RFC Demand- {{ horizon }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of filteredRows(); track row.fy + '|' + row.loc + '|' + row.serviceBundle + '|' + row.clientCorridor + '|' + row.wbsElement) {
                <tr>
                  <td>{{ row.loc }}</td>
                  <td>{{ row.serviceBundle }}</td>
                  <td>{{ row.clientCorridor || '-' }}</td>
                  <td>{{ row.wbsElement || '-' }}</td>
                  <td class="num">{{ formatPercent(row.ccPercent) }}</td>
                  <td class="num">{{ formatKey(tableKeyForRow(row)) }}</td>
                  <td class="num">{{ formatAmount(costKeyForRow(row)) }}</td>
                  <td class="num">{{ formatAmount(calculatedCostForHorizon(row, selectedHorizon())) }}</td>  
                  <td class="num">{{ formatAmount(costDemandForHorizon(row, selectedHorizon())) }}</td>                                 
                  @for (horizon of calculationPastHorizons(); track horizon) {
                    <td class="num">{{ formatAmount(calculatedCostForHorizon(row, horizon)) }}</td>
                    <td class="num">{{ formatAmount(costDemandForHorizon(row, horizon)) }}</td>
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
      min-width: 1600px;
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
export class CostKeyOverview implements OnInit {
  private static readonly cutoffHorizon = '25-09';

  private readonly costKeyApi = inject(CostKeyService);
  private readonly bundleApi = inject(ServiceBundleService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly rows = signal<CostKeyOverviewRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedFy = signal('');
  protected readonly selectedLoc = signal('');
  protected readonly selectedSb = signal('');

  protected readonly fyOptions = computed(() => [...new Set(this.rows().map((row) => row.fy).filter(Boolean))].sort());
  protected readonly locOptions = computed(() => [...new Set(this.rows().map((row) => row.loc).filter(Boolean))].sort());
  protected readonly sbOptions = computed(() => [...new Set(this.rows().map((row) => row.serviceBundle).filter(Boolean))].sort());

  protected readonly pastHorizons = computed(() => {
    const selected = this.selectedHorizon();
    const list = this.horizons();
    const selectedIndex = list.findIndex((horizon) => horizon.text === selected);

    if (selectedIndex < 0) {
      return [];
    }

    const horizons: LookupItem[] = [];
    for (let index = selectedIndex + 1; index < list.length; index++) {
      const horizon = list[index];
      if (!horizon?.text) {
        continue;
      }

      horizons.push(horizon);
      if (horizon.text === CostKeyOverview.cutoffHorizon) {
        break;
      }
    }

    return horizons;
  });

  protected readonly calculationHorizons = computed(() => {
    const selected = this.selectedHorizon();
    if (!selected) {
      return [] as string[];
    }

    return [selected, ...this.pastHorizons().map((horizon) => horizon.text)];
  });

  protected readonly calculationPastHorizons = computed(() => this.calculationHorizons().slice(1));

  protected readonly filteredRows = computed(() => {
    const fy = this.selectedFy();
    const loc = this.selectedLoc();
    const sb = this.selectedSb();

    // Derive the expected FY from the selected horizon: 26-xx → "25/26", 25-xx → "24/25", etc.
    // An explicit FY dropdown selection overrides the derived default.
    const horizonFy = this.deriveFyFromHorizon(this.selectedHorizon());
    const activeFy = fy || horizonFy;

    return this.rows()
      .filter((row) => (!activeFy || row.fy === activeFy) && (!loc || row.loc === loc) && (!sb || row.serviceBundle === sb))
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

  protected readonly demandByGroupAndHorizon = computed(() => {
    const rows = this.filteredRows();
    const horizons = this.calculationHorizons();
    const selected = this.selectedHorizon();
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

  protected readonly calculatedCostByGroupAndHorizon = computed(() => {
    const horizons = this.calculationHorizons();
    const demandMaps = this.demandByGroupAndHorizon();
    const result = new Map<string, Map<string, number | null>>();

    for (const [groupKey, demandByHorizon] of demandMaps) {
      const calcByHorizon = new Map<string, number | null>();

      for (const horizon of horizons) {
        calcByHorizon.set(horizon, this.calculateCostForHorizon(horizon, demandByHorizon));
      }

      result.set(groupKey, calcByHorizon);
    }

    return result;
  });

  protected readonly calculatedRowCostByRow = computed(() => {
    const rows = this.filteredRows();
    const selected = this.selectedHorizon();
    const costByGroup = this.calculatedCostByGroupAndHorizon();
    const result = new Map<string, number | null>();

    for (const row of rows) {
      const groupCost = costByGroup.get(this.groupKey(row))?.get(selected);
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
      const rowCost = rowCosts.get(this.rowKey(row));
      if (rowCost == null || Number.isNaN(rowCost)) {
        continue;
      }

      const partition = this.partitionKey(row);
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

    // Total Cost (kEUR) follows the requested formula over displayed records:
    // sum of [Calculated Cost (selected horizon) * PL key].
    const totalCostKeur = this.filteredRows().reduce((sum, row) => {
      const value = this.costKeyForRow(row);
      return sum + (value == null || Number.isNaN(value) ? 0 : value);
    }, 0);

    return [
      { label: 'Selected Horizon', value: this.selectedHorizon() || 'All' },
      { label: 'Selected Location', value: this.selectedLoc() || 'All' },
      { label: 'Total Cost RFC Demand (k EUR)', value: this.formatAmount(totalRfcDemand) },
      { label: 'Total Cost (k EUR)', value: this.formatAmount(totalCostKeur) },
      //{ label: 'Average Key', value: this.formatKey(averageKey) },
    ];
  });

  ngOnInit(): void {
    this.bundleApi.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data ?? []);
        if (data?.length) {
          this.selectedHorizon.set(data[0].text);
          this.loadData();
        }
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.loadData();
  }

  protected loadData(): void {
    const horizon = this.selectedHorizon();
    if (!horizon) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.costKeyApi.getOverview(horizon, this.selectedFy(), this.selectedLoc(), this.selectedSb()).subscribe({
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

    const selected = this.selectedHorizon();
    const pastHorizons = this.calculationPastHorizons();

    const headerRow: string[] = [
      'Location',
      'Service Bundle',
      'Client Corridor',
      'WBS Element',
      'PL Key',
      'Key',
      'Cost (K Eur)',
      `Calculated Cost - ${selected}`,
      `Cost RFC Demand - ${selected}`,
    ];

    for (const horizon of pastHorizons) {
      headerRow.push(`Calculated Cost - ${horizon}`);
      headerRow.push(`Cost RFC Demand - ${horizon}`);
    }

    const wsData: (string | number)[][] = [headerRow];

    for (const row of rows) {
      const dataRow: (string | number)[] = [
        row.loc,
        row.serviceBundle,
        row.clientCorridor || '-',
        row.wbsElement || '-',
        row.ccPercent ?? 0,
        this.tableKeyForRow(row) ?? 0,
        this.costKeyForRow(row) ?? 0,
        this.calculatedCostForHorizon(row, selected) ?? 0,
        this.costDemandForHorizon(row, selected) ?? 0,
      ];

      for (const horizon of pastHorizons) {
        dataRow.push(this.calculatedCostForHorizon(row, horizon) ?? 0);
        dataRow.push(this.costDemandForHorizon(row, horizon) ?? 0);
      }

      wsData.push(dataRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const columnCount = headerRow.length;
    ws['!cols'] = Array.from({ length: columnCount }, (_, i) => {
      if (i === 0) return { wch: 18 };
      if (i === 1) return { wch: 28 };
      if (i === 2) return { wch: 16 };
      if (i === 3) return { wch: 28 };
      return { wch: 14 };
    });

    const rowCount = rows.length + 1;
    for (let r = 2; r <= rowCount; r++) {
      ws[`E${r}`].z = '0.00%';
      ws[`F${r}`].z = '0.00%';

      for (let c = 7; c <= columnCount; c++) {
        const col = XLSX.utils.encode_col(c - 1);
        ws[`${col}${r}`].z = '#,##0.00';
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Key Overview');
    XLSX.writeFile(wb, `cost-key-overview-${selected || 'no-horizon'}.xlsx`);
  }

  protected formatAmount(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected calculatedCost(row: CostKeyOverviewRow): number | null {
    const value = this.calculatedCostByGroupAndHorizon().get(this.groupKey(row))?.get(this.selectedHorizon());
    return value == null || Number.isNaN(value) ? null : value;
  }

  protected costDemandForHorizon(row: CostKeyOverviewRow, horizon: string): number | null {
    const value = this.demandByGroupAndHorizon().get(this.groupKey(row))?.get(horizon);
    return value == null || Number.isNaN(value) ? null : value;
  }

  protected calculatedCostForHorizon(row: CostKeyOverviewRow, horizon: string): number | null {
    const value = this.calculatedCostByGroupAndHorizon().get(this.groupKey(row))?.get(horizon);
    return value == null || Number.isNaN(value) ? null : value;
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

    return foundAny ? sum : null;
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
    const demandPrev1 = prev1 ? demandByHorizon.get(prev1) : null;

    if (parsed.period === 12) {
      // xx-12 = [(Dxx12*12) - (Dprev1*3)] / 9
      if (demandPrev1 == null || Number.isNaN(demandPrev1)) {
        return null;
      }
      return ((demandCurrent * 12) - (demandPrev1 * 3)) / 9;
    }

    const prev2 = this.previousHorizon(horizon, 2);
    const demandPrev2 = prev2 ? demandByHorizon.get(prev2) : null;

    if (parsed.period === 3) {
      // xx-03 = [(Dxx03*12) - (Dprev1*3) - (Dprev2*3)] / 6
      if (demandPrev1 == null || Number.isNaN(demandPrev1) || demandPrev2 == null || Number.isNaN(demandPrev2)) {
        return null;
      }
      return ((demandCurrent * 12) - (demandPrev1 * 3) - (demandPrev2 * 3)) / 6;
    }

    const prev3 = this.previousHorizon(horizon, 3);
    const demandPrev3 = prev3 ? demandByHorizon.get(prev3) : null;

    if (parsed.period === 6) {
      // xx-06 = [(Dxx06*12) - (Dprev1*3) - (Dprev2*3) - (Dprev3*3)] / 3
      if (
        demandPrev1 == null || Number.isNaN(demandPrev1) ||
        demandPrev2 == null || Number.isNaN(demandPrev2) ||
        demandPrev3 == null || Number.isNaN(demandPrev3)
      ) {
        return null;
      }
      return ((demandCurrent * 12) - (demandPrev1 * 3) - (demandPrev2 * 3) - (demandPrev3 * 3)) / 3;
    }

    return null;
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

  protected formatKey(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * 100)}%`;
  }

  protected formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value * 100)}%`;
  }

}