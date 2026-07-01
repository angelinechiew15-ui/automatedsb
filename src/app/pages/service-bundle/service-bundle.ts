import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChartPoint,
  CostBreakdownRow,
  LookupItem,
  MeasureBreakdownRow,
  ServiceBundleCharts,
  ServiceBundleDashboard,
  ServiceBundleService,
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
  protected readonly error = signal<string | null>(null);

  protected readonly tabs = signal<ChartTab[]>([]);
  protected readonly activeTab = signal<string>('');
  /** Name of the searched service bundle, shown in the category titles. */
  protected readonly sbName = signal<string>('');

  // Chart data cached per tab id so switching tabs doesn't refetch.
  private readonly chartCache = signal<Record<string, ServiceBundleCharts>>({});
  protected readonly activeCharts = computed(
    () => this.chartCache()[this.activeTab()] ?? null,
  );

  // Plain method (not a computed) because the selected* fields are plain
  // properties, not signals — a computed would never re-evaluate on change.
  protected canSearch(): boolean {
    return !!this.selectedOwner && !!this.selectedSb && !!this.selectedHorizon;
  }

  // The dashboard/charts data is keyed on the horizon name (e.g. "26-06"),
  // while the dropdown value is the horizon id. Resolve the name to send.
  private horizonName(): string {
    return this.horizons().find((h) => h.value === this.selectedHorizon)?.text ?? this.selectedHorizon;
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

    this.api.getDashboard(this.selectedSb, this.horizonName()).subscribe({
      next: (data) => {
        this.buildTabs(data);
        this.searching.set(false);
        const first = this.tabs()[0];
        if (first) {
          this.setActive(first.id);
        }
      },
      error: () => {
        this.searching.set(false);
        this.error.set('Failed to load the Service Bundle dashboard.');
      },
    });
  }

  private buildTabs(d: ServiceBundleDashboard): void {
    this.sbName.set(d.sbName ?? '');
    const tabs: ChartTab[] = [
      { id: 'All', label: 'All', loc: '' },
      { id: 'RPTCentralAll', label: 'RPT Central', loc: '' },
      { id: 'RPTMUCESDAll', label: 'RPT MUC ESD', loc: '' },
    ];
    const excludedLocs = new Set(['RPT CENTRAL', 'RPT MUC ESD']);

    // The backend returns the ordered, data-driven list of location tabs
    // (RPT CENTRAL + mapped labs + any RPT location with actuals). Fall back to
    // the mapped labs only if the backend didn't supply it.
    const locs =
      d.validLocations && d.validLocations.length
        ? d.validLocations
        : (d.labs ?? []).map((l) => l.text).filter((t): t is string => !!t);

    for (const loc of locs) {
      if (excludedLocs.has(loc.toUpperCase())) {
        continue;
      }
      const label = loc === 'RPT CENTRAL' ? 'RPT Central' : loc;
      tabs.push({ id: loc.replace(/\s+/g, ''), label, loc });
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
    this.api.getCharts(this.selectedSb, this.horizonName(), tab.loc).subscribe({
      next: (charts) => {
        this.chartCache.update((c) => ({ ...c, [id]: charts }));
        this.loadingCharts.set(false);
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

  /** Cost demand line points sourced from detail rows (rfc w/o + depreciation + adder). */
  protected costDemandLinePoints(
    rows: CostBreakdownRow[] | undefined,
    fallback: ChartPoint[],
  ): ChartPoint[] {
    if (rows && rows.length) {
      return rows.map((r) => ({
        label: r.label,
        value: r.rfcWoDemand + r.depreciation + r.adderDemand,
      }));
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
  private isAllTab(): boolean {
    const tab = this.tabs().find((t) => t.id === this.activeTab());
    return !tab || tab.loc === '';
  }

  /** Template flag: show the detailed breakdown tables (location tabs only). */
  protected showDetail(): boolean {
    return !this.isAllTab();
  }

  /** All tab: drop decimals (nearest integer). Location tab: round the decimal up. */
  protected roundForTab(n: number): number {
    return this.isAllTab() ? Math.round(n) : Math.ceil(n);
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

  /** Table rows (fy_quarter, demand, actual, utilization) shown beside each chart. */
  protected comboRows(
    demand: ChartPoint[],
    actual: ChartPoint[],
    qtrAvg = false,
  ): { label: string; demand: number; actual: number; utilization: number }[] {
    const labels = this.comboLabels(demand, actual);
    const find = (pts: ChartPoint[], l: string) =>
      pts.find((p) => p.label === l)?.value ?? 0;
    return labels.map((l) => {
      const d = find(demand, l);
      const a = find(actual, l);
      const util = d !== 0 ? (a / d) * 100 : 0;
      return {
        label: qtrAvg ? this.qtrAvgLabel(l) : l,
        demand: this.roundForTab(d),
        actual: this.roundForTab(a),
        utilization: this.roundForTab(util),
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
      const demandWithAdder = r.baseDemand + r.adderDemand;
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
  protected costDetailRows(rows: CostBreakdownRow[] | undefined): CostDetailRow[] {
    return (rows ?? []).map((r) => {
      const demandWithAdder = r.rfcWoDemand + r.depreciation + r.adderDemand;
      const actualWithAdder = r.baseActual + r.changeActual;
      // Deviation: blank when actual-with-adder is exactly 0, or when there is no
      // demand to divide by; otherwise (actual / demand) - 1.
      const deviation =
        actualWithAdder === 0 || demandWithAdder === 0
          ? null
          : this.round2(actualWithAdder / demandWithAdder - 1);
      return {
        label: this.qtrAvgLabel(r.label),
        rfcWoDemand: this.roundForTab(r.rfcWoDemand),
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
}
