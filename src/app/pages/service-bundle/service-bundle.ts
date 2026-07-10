import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChartPoint,
  CostBreakdownRow,
  LookupItem,
  MeasureBreakdownRow,
  ServiceBundleDetailRow,
  ServiceBundleDetailUpsertRequest,
  ServiceBundleCharts,
  ServiceBundleDetails,
  ServiceBundleDashboard,
  ServiceBundleService,
  AdderData,
  AdderValues,
} from '../../services/service-bundle.service';
import { ChartCanvas, ChartSeries } from './chart-canvas';

interface ChartTab {
  id: string;
  label: string;
  loc: string;
}

/** A fully-derived TS/RTU detail row for the per-location tables. */
export interface MeasureDetailRow {
  label: string;
  baseDemand: number;
  adderDemand: number;
  demandWithAdder: number;
  baseActual: number;
  changeActual: number;
  actualWithAdder: number;
  utilization: number;
  rtuTs?: number;
}

/** A fully-derived Cost detail row for the per-location tables. */
export interface CostDetailRow {
  label: string;
  rfcWoDemand: number;
  depreciation: number;
  adderDemand: number;
  demandWithAdder: number;
  actual: number;
  changeActual: number;
  actualWithAdder: number;
  deviation: number | null;
  costRtu: number;
}

export interface ServiceBundleInfoState {
  detailRows: ServiceBundleDetailRow[];
  responsibility: ServiceBundleDetails['responsibility'] | null;
}
interface EditableDetailRow {
  rowKey: string;
  horizon: string;
  tsDetails: string;
  rtuDetails: string;
  costDetails: string;
  persisted: boolean;
}

@Component({
  selector: 'app-service-bundle',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartCanvas],
  templateUrl: './service-bundle.html',
  styleUrl: './service-bundle.css',
})
export class ServiceBundle implements OnInit {
  private readonly api = inject(ServiceBundleService);

  protected readonly owners = signal<LookupItem[]>([]);
  protected readonly sbNames = signal<LookupItem[]>([]);
  protected readonly horizons = signal<LookupItem[]>([]);

  protected selectedOwner = '';
  protected selectedSb = '';
  protected selectedHorizon = '';

  protected readonly loadingSbNames = signal(false);
  protected readonly searching = signal(false);
  protected readonly loadingCharts = signal(false);
  protected readonly loadingDetails = signal(false);
  protected readonly savingDetailRowKey = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly dashboard = signal<ServiceBundleDashboard | null>(null);
  protected readonly tabs = signal<ChartTab[]>([]);
  protected readonly activeTab = signal<string>('');
  /** Name of the searched service bundle, shown in the category titles. */
  protected readonly sbName = signal<string>('');

  protected readonly detailInfo = signal<ServiceBundleDetails | null>(null);
  protected readonly detailRows = signal<EditableDetailRow[]>([]);
  private detailRowSeq = 0;

  // Chart data cached per tab id so switching tabs doesn't refetch.
  private readonly chartCache = signal<Record<string, ServiceBundleCharts>>({});
  protected readonly activeCharts = computed(
    () => this.chartCache()[this.activeTab()] ?? null,
  );

  // --- Adder modal (TS / RTU / Cost), shown on location tabs only. ---
  protected readonly adderModalOpen = signal(false);
  protected readonly adderMeasure = signal<'TS' | 'RTU' | 'COST'>('TS');
  protected readonly adderData = signal<AdderData | null>(null);
  protected readonly loadingAdder = signal(false);
  protected readonly savingAdder = signal(false);
  protected readonly adderError = signal<string | null>(null);
  protected readonly adderLocation = signal<string>('');
  // Editable form models (bound with ngModel in the modal).
  protected adderForm: AdderValues = { py: null, q1: null, q2: null, q3: null, q4: null, ny: null };
  protected changeForm: AdderValues = { py: null, q1: null, q2: null, q3: null, q4: null, ny: null };

  // Plain method (not a computed) because the selected* fields are plain
  // properties, not signals — a computed would never re-evaluate on change.
  protected canSearch(): boolean {
    return !!this.selectedOwner && !!this.selectedSb && !!this.selectedHorizon;
  }

  // The dashboard/charts data is keyed on the horizon name (e.g. "26-06"),
  // while the dropdown value is the horizon id. Resolve the name to send.
  protected horizonName(): string {
    return this.horizons().find((h) => h.value === this.selectedHorizon)?.text ?? this.selectedHorizon;
  }

  private resolvedMucLocation(): string {
    return this.sbName().toLowerCase().includes('testfloor') ? 'RPT MUC ETC' : 'RPT MUC ESD';
  }

  private resolveLocationForTab(loc: string): string {
    if (loc.toUpperCase() === 'RPT MUC') {
      return this.resolvedMucLocation();
    }
    return loc;
  }

  ngOnInit(): void {
    this.api.listOwners().subscribe({
      next: (data) => this.owners.set(data),
      error: () => this.error.set('Failed to load Service Bundle owners.'),
    });
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length && !this.selectedHorizon) {
          this.selectedHorizon = data[0].value;
        }
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
  }

  protected onOwnerChange(): void {
    this.selectedSb = '';
    this.sbNames.set([]);
    if (!this.selectedOwner) {
      return;
    }
    this.loadingSbNames.set(true);
    this.api.listSbNames(this.selectedOwner).subscribe({
      next: (data) => {
        this.sbNames.set(data);
        this.loadingSbNames.set(false);
      },
      error: () => {
        this.loadingSbNames.set(false);
        this.error.set('Failed to load Service Bundle names.');
      },
    });
  }

  /** Rebuild tabs when the horizon changes (tab visibility depends on the data). */
  protected onHorizonChange(): void {
    if (!this.tabs().length) {
      return; // nothing searched yet; horizon applies on next search
    }
    this.loadDashboard();
  }

  protected search(): void {
    if (!this.canSearch()) {
      return;
    }
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.error.set(null);
    this.searching.set(true);
    this.tabs.set([]);
    this.chartCache.set({});
    this.dashboard.set(null);
    this.detailInfo.set(null);
    this.detailRows.set([]);

    this.api.getDashboard(this.selectedSb, this.horizonName()).subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.buildTabs(data);
        this.loadDetails();
        this.searching.set(false);
        const first = this.tabs()[0];
        if (first) {
          this.setActive(first.id);
        }
        // Build the recent-horizon history matrices (TS/RTU/Cost)
        this.buildHorizonHistory();
      },
      error: () => {
        this.searching.set(false);
        this.error.set('Failed to load the Service Bundle dashboard.');
      },
    });
  }

  private createDetailRow(row: Partial<ServiceBundleDetailRow> = {}, persisted = true): EditableDetailRow {
    this.detailRowSeq += 1;
    return {
      rowKey: `detail-row-${this.detailRowSeq}`,
      horizon: row.horizon ?? '',
      tsDetails: row.tsDetails ?? '',
      rtuDetails: row.rtuDetails ?? '',
      costDetails: row.costDetails ?? '',
      persisted,
    };
  }

  private loadDetails(): void {
    const drafts = this.detailRows().filter((row) => !row.persisted);
    this.loadingDetails.set(true);
    this.api.getServiceBundleDetails(this.selectedSb, this.horizonName()).subscribe({
      next: (data) => {
        this.detailInfo.set(data);
        this.detailRows.set([
          ...data.detailRows.map((row) => this.createDetailRow(row, true)),
          ...drafts,
        ]);
        this.loadingDetails.set(false);
      },
      error: () => {
        this.loadingDetails.set(false);
        this.error.set('Failed to load detailed service bundle information.');
      },
    });
  }

  private buildTabs(d: ServiceBundleDashboard): void {
    this.sbName.set(d.sbName ?? '');
    const mucLocation = this.resolvedMucLocation();
    const tabs: ChartTab[] = [
      { id: 'All', label: 'All', loc: '' },
      { id: 'RPTCentral', label: 'RPT Central', loc: 'RPT CENTRAL' },
      { id: mucLocation.replace(/\s+/g, ''), label: mucLocation, loc: mucLocation },
    ];
    const excludedLocs = new Set(['RPT CENTRAL', mucLocation.toUpperCase()]);

    // The backend returns the ordered, data-driven list of location tabs
    // (RPT CENTRAL + mapped labs + any RPT location with actuals). Fall back to
    // the mapped labs only if the backend didn't supply it.
    const locs =
      d.validLocations && d.validLocations.length
        ? d.validLocations
        : (d.labs ?? []).map((l) => l.text).filter((t): t is string => !!t);

    for (const loc of locs) {
      const resolvedLoc = this.resolveLocationForTab(loc);
      if (excludedLocs.has(resolvedLoc.toUpperCase())) {
        continue;
      }
      const label = resolvedLoc === 'RPT CENTRAL' ? 'RPT Central' : resolvedLoc;
      tabs.push({ id: resolvedLoc.replace(/\s+/g, ''), label, loc: resolvedLoc });
    }

    this.tabs.set(tabs);
  }

  protected setActive(id: string): void {
    this.activeTab.set(id);
    if (this.chartCache()[id]) {
      return; // already loaded
    }
    const tab = this.tabs().find((t) => t.id === id);
    if (!tab) {
      return;
    }
    this.loadingCharts.set(true);

    // If All tab, aggregate charts from all location tabs (sum values).
    if (!tab.loc) {
      const locTabs = this.tabs().filter((t) => !!t.loc).map((t) => this.resolveLocationForTab(t.loc));
      // Avoid duplicate locations
      const uniq = Array.from(new Set(locTabs));
      const calls = uniq.map((loc) => this.api.getCharts(this.selectedSb, this.horizonName(), loc));
      if (calls.length === 0) {
        // Fall back to server-provided All
        this.api.getCharts(this.selectedSb, this.horizonName(), '').subscribe({
          next: (charts) => {
            const processed = {
              ...charts,
              costDemand: this.costDemandLinePoints(charts.costRows, charts.costDemand, charts.rtuRows),
            };
            this.chartCache.update((c) => ({ ...c, [id]: processed }));
            this.chartCache.update((c) => ({ ...c, [id]: processed }));
            // Debug: print merged/processed chart data for verification in browser console
            // (helpful to confirm charts match table totals)
            // eslint-disable-next-line no-console
            console.debug('service-bundle: processed charts', id, processed);
            this.loadingCharts.set(false);
                this.buildHorizonHistory();
          },
          error: () => {
            this.loadingCharts.set(false);
            this.error.set('Failed to load chart data.');
          },
        });
        return;
      }
      // Use forkJoin to run all requests in parallel
      import('rxjs').then(({ forkJoin }) => {
        forkJoin(calls).subscribe({
          next: (results) => {
            // Merge all results into one aggregated chart. Start with the
            // first result and merge subsequent results to avoid double-counting.
            let merged = results[0];
            for (let i = 1; i < results.length; i++) {
              merged = this.mergeCharts(merged, results[i]);
            }
            const processed = {
              ...merged,
              costDemand: this.costDemandLinePoints(merged.costRows, merged.costDemand, merged.rtuRows),
            };
            this.chartCache.update((c) => ({ ...c, [id]: processed }));
            this.loadingCharts.set(false);
            this.buildHorizonHistory();
          },
          error: () => {
            this.loadingCharts.set(false);
            this.error.set('Failed to load chart data.');
          },
        });
      });
      return;
    }

    // Non-All tab: fetch single location charts as before
    this.api.getCharts(this.selectedSb, this.horizonName(), tab.loc).subscribe({
      next: (charts) => {
        const processed = {
          ...charts,
          costDemand: this.costDemandLinePoints(charts.costRows, charts.costDemand, charts.rtuRows),
        };
        this.chartCache.update((c) => ({ ...c, [id]: processed }));
        this.loadingCharts.set(false);
        this.buildHorizonHistory();
      },
      error: () => {
        this.loadingCharts.set(false);
        this.error.set('Failed to load chart data.');
      },
    });
  }

  protected labels(points: { label: string; value: number }[]): string[] {
    return points.map((p) => p.label);
  }

  protected values(points: { label: string; value: number }[]): number[] {
    return points.map((p) => p.value);
  }

  /** Quarter labels shared by a demand + actual pair. */
  protected comboLabels(demand: ChartPoint[], actual: ChartPoint[]): string[] {
    const longest = demand.length >= actual.length ? demand : actual;
    return longest.map((p) => p.label);
  }

  /** Annual (FY-only) rows have no quarter suffix; flag them as a quarterly average. */
  protected qtrAvgLabel(label: string): string {
    return label.includes(' ') ? label : `${label} Qtr. Avg`;
  }

  /** Chart x-axis labels with the "Qtr. Avg" suffix on annual rows (RTU/Cost). */
  protected comboLabelsAvg(demand: ChartPoint[], actual: ChartPoint[]): string[] {
    return this.comboLabels(demand, actual).map((l) => this.qtrAvgLabel(l));
  }

  /** Demand line points sourced from the detail rows (base + adder) on location
   *  tabs so the line matches the table's "with adder" total; falls back to the
   *  combined series on the All tab where no detail rows exist. */
  protected demandLinePoints(
    rows: MeasureBreakdownRow[] | undefined,
    fallback: ChartPoint[],
  ): ChartPoint[] {
    if (rows && rows.length) {
      return rows.map((r) => ({ label: r.label, value: r.baseDemand + r.adderDemand }));
    }
    return fallback;
  }

  /** Actual bar points sourced from detail rows (base + change) on location tabs. */
  protected actualBarPoints(
    rows: MeasureBreakdownRow[] | undefined,
    fallback: ChartPoint[],
  ): ChartPoint[] {
    if (rows && rows.length) {
      return rows.map((r) => ({ label: r.label, value: r.baseActual + r.changeActual }));
    }
    return fallback;
  }

  /** Cost demand line points sourced from detail rows (rfc w/o + depreciation + adder).
   *  If the cost RFC components are zero, fall back to using RTU RFC Demand * Cost/RTU
   *  divided by 1000 to convert to k EUR.
   */
  protected costDemandLinePoints(
    rows: CostBreakdownRow[] | undefined,
    fallback: ChartPoint[],
    rtuRows?: MeasureBreakdownRow[] | undefined,
  ): ChartPoint[] {
    if (rows && rows.length) {
      return rows.map((r) => {
        // Compute Cost RFC w/o Depreciation; if that's zero, fall back to
        // RTU RFC Demand * Cost/RTU (converted to k EUR). Then add depreciation
        // and adder to get the total Cost RFC Demand used for charts.
        let rfcWo = r.rfcWoDemand;
        if ((!rfcWo || rfcWo === 0) && rtuRows && rtuRows.length) {
          // Use the row's `costRtu` as the multiplier per FY quarter.
          const multiplier = r.costRtu ?? 0;
          const matching = rtuRows.find((rr) => rr.label === r.label);
          if (matching) {
            const rtuTotal = (matching.baseDemand ?? 0) + (matching.adderDemand ?? 0);
            if (rtuTotal !== 0 && multiplier != null) {
              rfcWo = (rtuTotal * multiplier) / 1000; // convert to k EUR
            }
          } else {
            // Try alternate label formats
            const alt = rtuRows.find(rr => rr.label === this.qtrAvgLabel(r.label) || this.qtrAvgLabel(rr.label) === r.label || rr.label === r.label);
            if (alt) {
              const rtuTotal2 = (alt.baseDemand ?? 0) + (alt.adderDemand ?? 0);
              if (rtuTotal2 !== 0 && multiplier != null) {
                rfcWo = (rtuTotal2 * multiplier) / 1000;
              }
            }
          }
        }
        const value = rfcWo + r.depreciation + r.adderDemand;
        return { label: r.label, value };
      });
    }
    return fallback;
  }

  /** Cost actual bar points sourced from detail rows (base + change). */
  protected costActualBarPoints(
    rows: CostBreakdownRow[] | undefined,
    fallback: ChartPoint[],
  ): ChartPoint[] {
    if (rows && rows.length) {
      return rows.map((r) => ({ label: r.label, value: r.baseActual + r.changeActual }));
    }
    return fallback;
  }

  /** True when the "All" (aggregate) tab is active, false for a single location. */
  protected isAllTab(): boolean {
    const tab = this.tabs().find((t) => t.id === this.activeTab());
    return !tab || tab.loc === '';
  }

  // Recent horizons columns (up to 5) for the history tables
  protected readonly recentHorizonCols = signal<string[]>([]);
  // Matrices for TS, RTU and Cost: array of rows where each row is { fy, values: (number | null)[] }
  // null indicates that FY does not apply to that horizon
  protected readonly tsHistory = signal<{ fy: string; values: (number | null)[] }[]>([]);
  protected readonly rtuHistory = signal<{ fy: string; values: (number | null)[] }[]>([]);
  protected readonly costHistory = signal<{ fy: string; values: (number | null)[] }[]>([]);

  /**
   * Build the horizon columns (newest→oldest) for the history tables: the currently
   * selected horizon plus the four preceding quarterly horizons (5 total).
   * Horizons use the fiscal format "YY-MM" where MM is a quarter month (03, 06, 09, 12).
   * Example: selected "26-06" → ["26-06", "26-03", "25-12", "25-09", "25-06"].
   */
  private buildRecentHorizons(): string[] {
    const selected = this.horizonName();
    const parts = selected.split('-');
    if (parts.length < 2) return [];
    let year = Number(parts[0]);
    let month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

    const cols: string[] = [];
    for (let i = 0; i < 5; i++) {
      cols.push(`${String(year).padStart(2, '0')}-${String(month).padStart(2, '0')}`);
      month -= 3;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
    }
    return cols;
  }

  private parseYearFromHorizon(h: string): number {
    const parts = h.split('-');
    const y = Number(parts[0]);
    return Number.isFinite(y) ? y : NaN;
  }

  private fyRowsForSelected(): string[] {
    // For selected horizon 'YY-XX', produce FY strings for previous and next FY
    const selected = this.horizons().find((h) => h.value === this.selectedHorizon)?.text ?? this.selectedHorizon;
    return this.fyRowsForHorizon(selected);
  }

  private fyRowsForHorizon(horizonText: string): string[] {
    // For horizon 'YY-XX', produce FY strings for previous and next FY
    const y = this.parseYearFromHorizon(horizonText);
    if (Number.isNaN(y)) return [];
    const prev = String(y - 1).padStart(2, '0');
    const cur = String(y).padStart(2, '0');
    const next = String(y + 1).padStart(2, '0');
    return [`${prev}/${cur}`, `${cur}/${next}`];
  }

  /** Get a numeric value for a fiscal year from a chart's series by summing matching labels. */
  private sumSeriesForFy(points: ChartPoint[] | undefined, fy: string): number {
    if (!points || !points.length) return 0;
    // Extract year parts from FY string (e.g., "25/26" -> 25, 26)
    const fyParts = fy.split('/').map((s) => s.trim());
    const fyYears = fyParts.map((s) => Number(s)).filter((n) => Number.isFinite(n));
    if (!fyYears.length) return 0;

    let sum = 0;
    for (const p of points) {
      if (!p || !p.label) continue;
      const label = p.label;
      // Try direct substring match first (for "25/26" format)
      if (label.includes(fy)) {
        sum += p.value ?? 0;
        continue;
      }
      // Try matching individual years (e.g., "25 Q1" contains "25" from "25/26")
      for (const y of fyYears) {
        const yStr = String(y);
        // Match at word boundary: "25 Q1" matches, but "125" would not
        if (label === yStr || label.match(new RegExp(`\\b${yStr}\\b`))) {
          sum += p.value ?? 0;
          break; // Each label point is counted only once
        }
      }
    }
    return sum;
  }

  /** True when a chart label belongs to the given fiscal year ("25/26" or "25/26 Q1"). */
  private labelBelongsToFy(label: string, fy: string): boolean {
    const l = label.trim();
    return l === fy || l.startsWith(`${fy} `);
  }

  /**
   * TS Demand history value for one fiscal year within one horizon's TS series.
   * When the fiscal year is returned in quarterly ("Q") form (e.g. "25/26 Q1..Q4"),
   * the four quarters sum to 4× a quarter, so the total is divided by 4 to match the
   * quarterly-average annual rows (e.g. "26/27"). Returns null when the FY has no data.
   */
  private tsDemandForFy(points: ChartPoint[] | undefined, fy: string): number | null {
    if (!points || !points.length) return null;
    const matched = points.filter((p) => p?.label && this.labelBelongsToFy(p.label, fy));
    if (!matched.length) return null;
    const sum = matched.reduce((acc, p) => acc + (p.value ?? 0), 0);
    const isQuarterly = matched.some((p) => /q/i.test(p.label));
    return isQuarterly ? sum / 4 : sum;
  }

  /**
   * RTU Demand history value for one fiscal year within one horizon's RTU series.
   * When the fiscal year is returned in quarterly ("Q") form (e.g. "25/26 Q1..Q4"),
   * the four quarters already total a full year, so it is kept as-is. Non-quarterly
   * annual rows are a quarterly average and are multiplied by 4 to get the full-year
   * total. Returns null when the FY has no data.
   */
  private rtuDemandForFy(points: ChartPoint[] | undefined, fy: string): number | null {
    if (!points || !points.length) return null;
    const matched = points.filter((p) => p?.label && this.labelBelongsToFy(p.label, fy));
    if (!matched.length) return null;
    const sum = matched.reduce((acc, p) => acc + (p.value ?? 0), 0);
    const isQuarterly = matched.some((p) => /q/i.test(p.label));
    return isQuarterly ? sum : sum * 4;
  }

  /**
   * Cost Demand history value for one fiscal year within one horizon's Cost series.
   * Same rule as RTU: quarterly ("Q") FYs (e.g. "25/26 Q1..Q4") already total a full
   * year and are kept as-is; non-quarterly annual rows are a quarterly average and are
   * multiplied by 4 to get the full-year total. Returns null when the FY has no data.
   */
  private costDemandForFy(points: ChartPoint[] | undefined, fy: string): number | null {
    if (!points || !points.length) return null;
    const matched = points.filter((p) => p?.label && this.labelBelongsToFy(p.label, fy));
    if (!matched.length) return null;
    const sum = matched.reduce((acc, p) => acc + (p.value ?? 0), 0);
    const isQuarterly = matched.some((p) => /q/i.test(p.label));
    return isQuarterly ? sum : sum * 4;
  }

  /** Fetch aggregated charts for a single horizon (merge locations when All tab). */
  private fetchAggregatedChartsForHorizon(horizonText: string) {
    return new Promise<ServiceBundleCharts>((resolve, reject) => {
      const tab = this.tabs().find((t) => t.id === this.activeTab());
      const isAll = !tab || tab.loc === '';
      if (!isAll) {
        this.api.getCharts(this.selectedSb, horizonText, tab?.loc ?? '').subscribe({ next: resolve, error: reject });
        return;
      }
      const locs = this.tabs().filter((t) => !!t.loc).map((t) => this.resolveLocationForTab(t.loc));
      const uniq = Array.from(new Set(locs));
      if (uniq.length === 0) {
        // fallback to server All
        this.api.getCharts(this.selectedSb, horizonText, '').subscribe({ next: resolve, error: reject });
        return;
      }
      import('rxjs').then(({ forkJoin }) => {
        const calls = uniq.map((loc) => this.api.getCharts(this.selectedSb, horizonText, loc));
        forkJoin(calls).subscribe({
          next: (results) => {
            // merge results sequentially
            let merged = results[0];
            for (let i = 1; i < results.length; i++) merged = this.mergeCharts(merged, results[i]);
            resolve(merged);
          },
          error: reject,
        });
      });
    });
  }

  /** Build the history matrices for TS, RTU and Cost across recent horizons. */
  private buildHorizonHistory(): void {
    // buildRecentHorizons returns newest→oldest; display columns run oldest→newest.
    const cols = this.buildRecentHorizons();
    const displayCols = [...cols].reverse();
    this.recentHorizonCols.set(displayCols);
    if (!this.selectedSb || !displayCols.length) {
      this.tsHistory.set([]);
      this.rtuHistory.set([]);
      this.costHistory.set([]);
      return;
    }
    // Fetch aggregated charts in display order so charts[i] maps to displayCols[i].
    Promise.all(displayCols.map((h) => this.fetchAggregatedChartsForHorizon(h)))
      .then((charts) => {
        // Collect all unique FYs across all horizons by inspecting the actual row labels
        const allFysSet = new Set<string>();
        for (const chart of charts) {
          // Extract FY from tsRows labels (e.g., "24/25", "25/26", "26/27")
          if (chart?.tsRows && chart.tsRows.length) {
            for (const row of chart.tsRows) {
              // Match FY pattern: "YY/YY"
              const match = row.label.match(/(\d{2}\/\d{2})/);
              if (match) {
                allFysSet.add(match[1]);
              }
            }
          }
        }
        // Sort FYs ascending, then keep only the two most recent (e.g. 25/26, 26/27).
        const allFys = Array.from(allFysSet).sort().slice(-2);

        const tsRows: { fy: string; values: (number | null)[] }[] = [];
        const rtuRows: { fy: string; values: (number | null)[] }[] = [];
        const costRows: { fy: string; values: (number | null)[] }[] = [];

        for (const fy of allFys) {
          const tsVals: (number | null)[] = [];
          const rtuVals: (number | null)[] = [];
          const costVals: (number | null)[] = [];

          // For each horizon column (in display order: oldest→newest)
          for (let displayIdx = 0; displayIdx < displayCols.length; displayIdx++) {
            const chart = charts[displayIdx];

            // Calculate TS value for this FY in this horizon. Quarterly ("Q") FYs are
            // divided by 4 so they match the quarterly-average annual rows.
            const tsComputed = this.demandLinePoints(chart?.tsRows, chart?.tsDemand);
            const tsVal = this.tsDemandForFy(tsComputed, fy);
            tsVals.push(tsVal !== null && tsVal > 0 ? tsVal : null);

            // Calculate RTU value for this FY in this horizon. Quarterly ("Q") FYs are
            // kept as-is; non-quarterly annual rows are multiplied by 4 for the full year.
            const rtuComputed = this.demandLinePoints(chart?.rtuRows, chart?.rtuDemand);
            const rtuVal = this.rtuDemandForFy(rtuComputed, fy);
            rtuVals.push(rtuVal !== null && rtuVal > 0 ? rtuVal : null);

            // Calculate Cost value for this FY in this horizon. Quarterly ("Q") FYs are
            // kept as-is; non-quarterly annual rows are multiplied by 4 for the full year.
            const costComputed = this.costDemandLinePoints(chart?.costRows, chart?.costDemand, chart?.rtuRows);
            const costVal = this.costDemandForFy(costComputed, fy);
            costVals.push(costVal !== null && costVal > 0 ? costVal : null);
          }

          tsRows.push({ fy, values: tsVals });
          rtuRows.push({ fy, values: rtuVals });
          costRows.push({ fy, values: costVals });
        }
        this.tsHistory.set(tsRows);
        this.rtuHistory.set(rtuRows);
        this.costHistory.set(costRows);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('buildHorizonHistory error:', err);
        this.tsHistory.set([]);
        this.rtuHistory.set([]);
        this.costHistory.set([]);
      });
  }

  /** Template flag: show the detailed breakdown tables (location tabs only). */
  protected showDetail(): boolean {
    return !this.isAllTab();
  }

  /** The resolved location of the currently active (non-All) tab. */
  protected activeTabLocation(): string {
    const tab = this.tabs().find((t) => t.id === this.activeTab());
    return tab?.loc ?? '';
  }

  /** Human label for the current measure in the modal title. */
  protected adderMeasureLabel(): string {
    return this.adderMeasure() === 'COST' ? 'Cost' : this.adderMeasure();
  }

  /** Open the Adder modal for the given measure on the active location tab. */
  protected openAdder(measure: 'TS' | 'RTU' | 'COST'): void {
    const location = this.activeTabLocation();
    if (!location || !this.sbName() || !this.selectedHorizon) {
      return;
    }
    this.adderMeasure.set(measure);
    this.adderLocation.set(location);
    this.adderError.set(null);
    this.adderData.set(null);
    this.adderForm = { py: null, q1: null, q2: null, q3: null, q4: null, ny: null };
    this.changeForm = { py: null, q1: null, q2: null, q3: null, q4: null, ny: null };
    this.adderModalOpen.set(true);
    this.loadingAdder.set(true);
    this.api.getAdder(this.sbName(), location, measure, this.horizonName()).subscribe({
      next: (data) => {
        this.adderData.set(data);
        this.adderForm = { ...data.adder };
        this.changeForm = { ...data.change };
        this.loadingAdder.set(false);
      },
      error: () => {
        this.loadingAdder.set(false);
        this.adderError.set('Failed to load adder values.');
      },
    });
  }

  protected closeAdder(): void {
    if (this.savingAdder()) {
      return;
    }
    this.adderModalOpen.set(false);
  }

  protected saveAdder(): void {
    if (this.savingAdder()) {
      return;
    }
    this.savingAdder.set(true);
    this.adderError.set(null);
    this.api
      .saveAdder({
        sbName: this.sbName(),
        location: this.adderLocation(),
        measure: this.adderMeasure(),
        horizon: this.horizonName(),
        adder: { ...this.adderForm },
        change: { ...this.changeForm },
      })
      .subscribe({
        next: () => {
          this.savingAdder.set(false);
          this.adderModalOpen.set(false);
          // Refresh charts/history so the new adder values are reflected.
          this.chartCache.set({});
          const active = this.activeTab();
          this.setActive(active);
          this.buildHorizonHistory();
        },
        error: () => {
          this.savingAdder.set(false);
          this.adderError.set('Failed to save adder values.');
        },
      });
  }

  /** All tab: drop decimals (nearest integer). Location tab: round the decimal up. */
  protected roundForTab(n: number): number {
    return this.isAllTab() ? Math.round(n) : Math.ceil(n);
  }

  protected roundForHistoryTab(n: number | null): string {
    if (n === null) {
      return '—'; // em-dash for N/A
    }
    return String(this.roundForTab(n));
  }

  /** Combined line (demand) + bar (actual) datasets for a measure. */
  protected comboDatasets(
    demand: ChartPoint[],
    actual: ChartPoint[],
    demandLabel: string,
    actualLabel: string,
    lineColor = '#0a8276',
    barColor = '#1a6bb5',
  ): ChartSeries[] {
    const labels = this.comboLabels(demand, actual);
    const align = (pts: ChartPoint[]) =>
      labels.map((l) => this.roundForTab(pts.find((p) => p.label === l)?.value ?? 0));
    return [
      { label: demandLabel, data: align(demand), color: lineColor, kind: 'line' },
      { label: actualLabel, data: align(actual), color: barColor, kind: 'bar' },
    ];
  }

  /** Merge two ServiceBundleCharts by summing numeric values for matching labels.
   *  Preserves the order of labels from the first chart, then appends extras from the second.
   */
  private mergeCharts(a: ServiceBundleCharts, b: ServiceBundleCharts): ServiceBundleCharts {
    const mergePoints = (pA: ChartPoint[] = [], pB: ChartPoint[] = []) => {
      const map = new Map<string, number>();
      for (const p of pA) map.set(p.label, (map.get(p.label) ?? 0) + (p.value ?? 0));
      for (const p of pB) map.set(p.label, (map.get(p.label) ?? 0) + (p.value ?? 0));
      const labels: string[] = [];
      for (const p of pA) labels.push(p.label);
      for (const p of pB) if (!labels.includes(p.label)) labels.push(p.label);
      return labels.map((l) => ({ label: l, value: map.get(l) ?? 0 }));
    };

    const mergeMeasureRows = (rA: MeasureBreakdownRow[] = [], rB: MeasureBreakdownRow[] = []) => {
      const map = new Map<string, MeasureBreakdownRow>();
      for (const r of rA) map.set(r.label, { ...r });
      for (const r of rB) {
        const existing = map.get(r.label);
        if (existing) {
          existing.baseDemand = (existing.baseDemand ?? 0) + (r.baseDemand ?? 0);
          existing.adderDemand = (existing.adderDemand ?? 0) + (r.adderDemand ?? 0);
          existing.baseActual = (existing.baseActual ?? 0) + (r.baseActual ?? 0);
          existing.changeActual = (existing.changeActual ?? 0) + (r.changeActual ?? 0);
          if (r.rtuTs !== undefined) existing.rtuTs = (existing.rtuTs ?? 0) + r.rtuTs;
        } else {
          map.set(r.label, { ...r });
        }
      }
      const labels: string[] = [];
      for (const r of rA) labels.push(r.label);
      for (const r of rB) if (!labels.includes(r.label)) labels.push(r.label);
      return labels.map((l) => map.get(l) as MeasureBreakdownRow);
    };

    const mergeCostRows = (rA: CostBreakdownRow[] = [], rB: CostBreakdownRow[] = []) => {
      const map = new Map<string, CostBreakdownRow>();
      for (const r of rA) map.set(r.label, { ...r });
      for (const r of rB) {
        const existing = map.get(r.label);
        if (existing) {
          existing.rfcWoDemand = (existing.rfcWoDemand ?? 0) + (r.rfcWoDemand ?? 0);
          existing.depreciation = (existing.depreciation ?? 0) + (r.depreciation ?? 0);
          existing.adderDemand = (existing.adderDemand ?? 0) + (r.adderDemand ?? 0);
          existing.baseActual = (existing.baseActual ?? 0) + (r.baseActual ?? 0);
          existing.changeActual = (existing.changeActual ?? 0) + (r.changeActual ?? 0);
          if (existing.costRtu !== undefined && r.costRtu !== undefined) {
            existing.costRtu = (existing.costRtu + r.costRtu) / 2;
          } else if (r.costRtu !== undefined) {
            existing.costRtu = r.costRtu;
          }
        } else {
          map.set(r.label, { ...r });
        }
      }
      const labels: string[] = [];
      for (const r of rA) labels.push(r.label);
      for (const r of rB) if (!labels.includes(r.label)) labels.push(r.label);
      return labels.map((l) => map.get(l) as CostBreakdownRow);
    };

    return {
      success: (a?.success ?? false) || (b?.success ?? false),
      tsDemand: mergePoints(a?.tsDemand, b?.tsDemand),
      tsActual: mergePoints(a?.tsActual, b?.tsActual),
      rtuDemand: mergePoints(a?.rtuDemand, b?.rtuDemand),
      rtuActual: mergePoints(a?.rtuActual, b?.rtuActual),
      costDemand: mergePoints(a?.costDemand, b?.costDemand),
      costActual: mergePoints(a?.costActual, b?.costActual),
      pareto: mergePoints(a?.pareto, b?.pareto),
      tsRows: mergeMeasureRows(a?.tsRows, b?.tsRows),
      rtuRows: mergeMeasureRows(a?.rtuRows, b?.rtuRows),
      costRows: mergeCostRows(a?.costRows, b?.costRows),
    } as ServiceBundleCharts;
  }

  /** Table rows (fy_quarter, demand, actual, utilization) shown beside each chart. */
  protected comboRows(
    demand: ChartPoint[],
    actual: ChartPoint[],
    qtrAvg = false,
  ): { label: string; demand: number; actual: number; utilization: number; deviation: number | null }[] {
    const labels = this.comboLabels(demand, actual);
    const find = (pts: ChartPoint[], l: string) =>
      pts.find((p) => p.label === l)?.value ?? 0;
    return labels.map((l) => {
      const d = find(demand, l);
      const a = find(actual, l);
      const util = d !== 0 ? (a / d) * 100 : 0;
      // Deviation: (actual / demand) - 1; blank when either side is 0.
      const deviation = a === 0 || d === 0 ? null : Math.round((a / d - 1) * 10000) / 10000;
      return {
        label: qtrAvg ? this.qtrAvgLabel(l) : l,
        demand: this.roundForTab(d),
        actual: this.roundForTab(a),
        utilization: this.roundForTab(util),
        deviation,
      };
    });
  }

  /** Round ratios/percentages to 2 decimals. */
  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Detailed TS/RTU rows (location tabs): base, adder, with-adder, actual, utilization. */
  protected measureDetailRows(rows: MeasureBreakdownRow[] | undefined, qtrAvg = false): MeasureDetailRow[] {
    return (rows ?? []).map((r) => {
      let demandWithAdder = r.baseDemand + r.adderDemand;
      const actualWithAdder = r.baseActual + r.changeActual;
      const util = demandWithAdder !== 0 ? (actualWithAdder / demandWithAdder) * 100 : 0;
      const row: MeasureDetailRow = {
        label: qtrAvg ? this.qtrAvgLabel(r.label) : r.label,
        baseDemand: this.roundForTab(r.baseDemand),
        adderDemand: this.roundForTab(r.adderDemand),
        demandWithAdder: this.roundForTab(demandWithAdder),
        baseActual: this.roundForTab(r.baseActual),
        changeActual: this.roundForTab(r.changeActual),
        actualWithAdder: this.roundForTab(actualWithAdder),
        utilization: this.roundForTab(util),
      };
      if (r.rtuTs !== undefined) {
        row.rtuTs = this.round2(r.rtuTs);
      }
      return row;
    });
  }

  /** Detailed Cost rows (location tabs): demand components, actual, deviation. */
  protected costDetailRows(rows: CostBreakdownRow[] | undefined, rtuRows?: MeasureBreakdownRow[] | undefined): CostDetailRow[] {
    return (rows ?? []).map((r) => {
      // Determine Cost RFC w/o Depreciation first; if zero, fall back to RTU*costRtu
      let rfcWo = r.rfcWoDemand;
      if ((!rfcWo || rfcWo === 0) && rtuRows && rtuRows.length) {
        // Use the row's `costRtu` as the multiplier per FY quarter.
        const multiplier = r.costRtu ?? 0;
        const matching = rtuRows.find((rr) => rr.label === r.label);
        if (matching) {
          const rtuTotal = (matching.baseDemand ?? 0) + (matching.adderDemand ?? 0);
          if (rtuTotal !== 0 && multiplier != null) {
            rfcWo = (rtuTotal * multiplier) / 1000; // convert to k EUR
          }
        } else {
          const alt = rtuRows.find(rr => rr.label === this.qtrAvgLabel(r.label) || this.qtrAvgLabel(rr.label) === r.label || rr.label === r.label);
          if (alt) {
            const rtuTotal2 = (alt.baseDemand ?? 0) + (alt.adderDemand ?? 0);
            if (rtuTotal2 !== 0 && multiplier != null) {
              rfcWo = (rtuTotal2 * multiplier) / 1000;
            }
          }
        }
      }
      let demandWithAdder = rfcWo + r.depreciation + r.adderDemand;
      const actualWithAdder = r.baseActual + r.changeActual;
      // If cost RFC components are zero, fall back to RTU * cost/rtu (converted to k EUR)
      if ((!demandWithAdder || demandWithAdder === 0) && r.costRtu !== undefined && rtuRows && rtuRows.length) {
        const matching = rtuRows.find((rr) => rr.label === r.label);
        if (matching) {
          const rtuTotal = (matching.baseDemand ?? 0) + (matching.adderDemand ?? 0);
          if (rtuTotal !== 0) {
            demandWithAdder = (rtuTotal * r.costRtu) / 1000; // convert to k EUR
          }
        }
      }
      // Deviation: blank when actual-with-adder is exactly 0, or when there is no
      // demand to divide by; otherwise (actual / demand) - 1, shown as a percentage.
      const deviation =
        actualWithAdder === 0 || demandWithAdder === 0
          ? null
          : Math.round((actualWithAdder / demandWithAdder - 1) * 10000) / 10000;
      return {
        label: this.qtrAvgLabel(r.label),
        rfcWoDemand: this.roundForTab(rfcWo),
        depreciation: this.roundForTab(r.depreciation),
        adderDemand: this.roundForTab(r.adderDemand),
        demandWithAdder: this.roundForTab(demandWithAdder),
        actual: this.roundForTab(r.baseActual),
        changeActual: this.roundForTab(r.changeActual),
        actualWithAdder: this.roundForTab(actualWithAdder),
        deviation,
        costRtu: this.round2(r.costRtu),
      };
    });
  }

  protected uniqueLabNames(): string[] {
    const seen = new Map<string, string>();
    for (const lab of this.dashboard()?.labs ?? []) {
      if (lab.value && !seen.has(lab.value)) {
        seen.set(lab.value, lab.text);
      }
    }
    return Array.from(seen.values());
  }

  protected addDetailRow(): void {
    this.detailRows.update((rows) => [...rows, this.createDetailRow({}, false)]);
  }

  protected canSaveDetailRow(row: EditableDetailRow): boolean {
    return !!row.horizon.trim() && !!(row.tsDetails.trim() || row.rtuDetails.trim() || row.costDetails.trim());
  }

  protected saveDetailRow(row: EditableDetailRow): void {
    if (!this.canSaveDetailRow(row) || !this.selectedSb) {
      return;
    }

    this.error.set(null);
    this.savingDetailRowKey.set(row.rowKey);

    const payload: ServiceBundleDetailUpsertRequest = {
      sbId: this.selectedSb,
      horizon: row.horizon,
      tsDetails: row.tsDetails,
      rtuDetails: row.rtuDetails,
      costDetails: row.costDetails,
    };

    this.api.saveServiceBundleDetail(payload).subscribe({
      next: () => {
        this.detailRows.update((rows) => rows.map((current) =>
          current.rowKey === row.rowKey ? { ...current, persisted: true } : current,
        ));
        this.loadDetails();
        this.savingDetailRowKey.set(null);
      },
      error: () => {
        this.savingDetailRowKey.set(null);
        this.error.set('Failed to save the detailed service bundle row.');
      },
    });
  }
}
