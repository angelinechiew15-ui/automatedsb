import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChartPoint,
  LookupItem,
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

  /** Re-filter the already-loaded charts when the horizon changes. */
  protected onHorizonChange(): void {
    if (!this.tabs().length) {
      return; // nothing searched yet; horizon applies on next search
    }
    this.chartCache.set({});
    const active = this.activeTab();
    if (active) {
      this.setActive(active);
    }
  }

  protected search(): void {
    if (!this.canSearch()) {
      return;
    }
    this.error.set(null);
    this.searching.set(true);
    this.tabs.set([]);
    this.chartCache.set({});

    this.api.getDashboard(this.selectedSb).subscribe({
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
    const isTestfloor = (d.sbName ?? '').toLowerCase().includes('testfloor');
    const tabs: ChartTab[] = [{ id: 'All', label: 'All', loc: '' }];

    tabs.push({ id: 'RPTCENTRAL', label: 'RPT Central', loc: 'RPT CENTRAL' });
    if (!isTestfloor) {
      tabs.push({ id: 'RPTMUCESD', label: 'RPT MUC ESD', loc: 'RPT MUC ESD' });
    }

    for (const lab of d.labs ?? []) {
      if (!lab.text) {
        continue;
      }
      tabs.push({ id: lab.value || lab.text, label: lab.text, loc: lab.text });
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
    this.api.getCharts(this.selectedSb, this.selectedHorizon, tab.loc).subscribe({
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

  /** Combined line (demand) + bar (actual) datasets for a measure. */
  protected comboDatasets(
    demand: ChartPoint[],
    actual: ChartPoint[],
    demandLabel: string,
    actualLabel: string,
  ): ChartSeries[] {
    const labels = this.comboLabels(demand, actual);
    const align = (pts: ChartPoint[]) =>
      labels.map((l) => pts.find((p) => p.label === l)?.value ?? 0);
    return [
      { label: demandLabel, data: align(demand), color: '#0a8276', kind: 'line' },
      { label: actualLabel, data: align(actual), color: '#1a6bb5', kind: 'bar' },
    ];
  }

  /** Table rows (fy_quarter, demand, actual) shown beside each chart. */
  protected comboRows(
    demand: ChartPoint[],
    actual: ChartPoint[],
  ): { label: string; demand: number; actual: number }[] {
    const labels = this.comboLabels(demand, actual);
    const find = (pts: ChartPoint[], l: string) =>
      pts.find((p) => p.label === l)?.value ?? 0;
    return labels.map((l) => ({
      label: l,
      demand: find(demand, l),
      actual: find(actual, l),
    }));
  }
}
