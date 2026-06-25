import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LookupItem {
  value: string;
  text: string;
}

/** A row of the SB-owner-to-SB mapping (same source as the admin SB Owner filter). */
interface SbOwnerRow {
  sb: string;
  sbname: string;
  persid: string;
  persname: string;
}

export interface ServiceBundleDashboard {
  success: boolean;
  sbId: string;
  sbName: string;
  clientCorridors: string[];
  labs: LookupItem[];
  /** Locations that have TS/RTU/COST actuals and TS demand > 0 for the horizon. */
  validLocations?: string[];
}

export interface ChartPoint {
  label: string;
  value: number;
}

/** Raw component values for a TS/RTU detail row (location tabs only). */
export interface MeasureBreakdownRow {
  label: string;
  baseDemand: number;
  adderDemand: number;
  baseActual: number;
  changeActual: number;
  /** Only present for RTU rows. */
  rtuTs?: number;
}

/** Raw component values for a Cost detail row (location tabs only). */
export interface CostBreakdownRow {
  label: string;
  rfcWoDemand: number;
  depreciation: number;
  adderDemand: number;
  baseActual: number;
  changeActual: number;
  costRtu: number;
}

export interface ServiceBundleCharts {
  success: boolean;
  tsDemand: ChartPoint[];
  tsActual: ChartPoint[];
  rtuDemand: ChartPoint[];
  rtuActual: ChartPoint[];
  costDemand: ChartPoint[];
  costActual: ChartPoint[];
  pareto: ChartPoint[];
  tsRows: MeasureBreakdownRow[];
  rtuRows: MeasureBreakdownRow[];
  costRows: CostBreakdownRow[];
}

/** A row of quarterly-average lab cost data from v_sb_asb_data.
 *
 *  cost value = COALESCE(rfcwodemand,0) + COALESCE(depreciation,0) + COALESCE(adderdemand,0)
 *  (mirrors the Tableau calc: ZN([Cost RFC w/o Depreciation]) + ZN([Depreciation]) + ZN([Adder Value Cost Demand]))
 *
 *  Backend query shape:
 *    SELECT rptloc AS location, sb, fy,
 *           AVG(COALESCE(rfcwodemand,0) + COALESCE(depreciation,0) + COALESCE(adderdemand,0)) AS value
 *    FROM   v_sb_asb_data
 *    WHERE  horizon = @horizon
 *    GROUP  BY rptloc, sb, fy
 *    ORDER  BY rptloc, sb, fy
 */
export interface LabCostRow {
  location: string;
  sb: string;
  sbname: string;
  fy: string;
  value: number | null;
}

/** One row per (fyQuarter, location, horizon, sb) from the Lab Summary endpoint. */
export interface LabSummaryRow {
  fyQuarter:     string;
  location:      string;
  horizon:       string;
  sb:            string;
  tsDemand:      number | null;
  adderTs:       number | null;
  tsActual:      number | null;
  changeTs:      number | null;
  rtuRfcDemand:  number | null;
  adderRtu:      number | null;
  rtuTs:         number | null;
  rtuActual:     number | null;
  changeRtu:     number | null;
  costRfcWoDepr: number | null;
  depreciation:  number | null;
  costRfcDemand: number | null;
  adderCost:     number | null;
  costRtu:       number | null;
  costActual:    number | null;
}

/** Distinct filter option values for the Lab Cost dropdowns. */
export interface LabCostFilterOptions {
  locations: string[];
  sbs:       LookupItem[];
}

/** Distinct filter option values for the Lab Summary dropdowns. */
export interface LabSummaryFilterOptions {
  fyQuarters: string[];
  locations:  string[];
  sbs:        string[];
}

export interface SbApprovalRow {
  horizon: string;
  sbName: string;
  ownerName: string;
  customerGroup: string;
  customerName: string;
  approvalStatus: string;
}
@Injectable({ providedIn: 'root' })
export class ServiceBundleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /**
   * SB owners for the owner dropdown. Uses the same source as the admin
   * "Service Bundle Owner" filter: unique (persname -> persid) pairs from the
   * SB-owner-to-SB mapping.
   */
  listOwners(): Observable<LookupItem[]> {
    return this.http.get<SbOwnerRow[]>(`${this.base}/sb-owners`).pipe(
      map((rows) => {
        const ownerMap = new Map<string, string>(); // persname -> persid
        for (const r of rows ?? []) {
          if (r.persname && !ownerMap.has(r.persname)) {
            ownerMap.set(r.persname, r.persid);
          }
        }
        return Array.from(ownerMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([persname, persid]) => ({ value: persid, text: persname }));
      }),
    );
  }

  /** Current RFC / horizon options. */
  listHorizons(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.base}/refs/horizons`);
  }

  /** SB names filtered by the selected owner. */
  listSbNames(ownerId: string): Observable<LookupItem[]> {
    const params = new HttpParams().set('ownerId', ownerId ?? '');
    return this.http.get<LookupItem[]>(`${this.base}/service-bundle/sb-names`, { params });
  }

  /** Dashboard metadata (SB name, client corridors, labs) for the selected SB. */
  getDashboard(sbId: string, horizon = ''): Observable<ServiceBundleDashboard> {
    let params = new HttpParams().set('sbId', sbId);
    if (horizon) {
      params = params.set('horizon', horizon);
    }
    return this.http.get<ServiceBundleDashboard>(`${this.base}/service-bundle/dashboard`, { params });
  }

  /** Chart data (demand, RTU, test starts, pareto) for a SB, horizon and optional location. */
  getCharts(sbId: string, horizon: string, loc = ''): Observable<ServiceBundleCharts> {
    let params = new HttpParams().set('sbId', sbId).set('horizon', horizon);
    if (loc) {
      params = params.set('loc', loc);
    }
    return this.http.get<ServiceBundleCharts>(`${this.base}/service-bundle/charts`, { params });
  }

  /**
   * Quarterly-average lab cost per SB per fiscal year for a given horizon.
   * Sourced from v_sb_asb_data.
   * Cost = COALESCE(rfcwodemand,0) + COALESCE(depreciation,0) + COALESCE(adderdemand,0)
   */
  getLabCostQtrAvg(horizon: string): Observable<LabCostRow[]> {
    const params = new HttpParams().set('horizon', horizon);
    return this.http.get<LabCostRow[]>(`${this.base}/lab-cost/qtr-avg`, { params });
  }

  /** All TS/RTU/Cost measures per (fyQuarter, location, horizon, sb) for the Lab Summary tab. */
  getLabSummary(horizon: string): Observable<LabSummaryRow[]> {
    const params = new HttpParams().set('horizon', horizon);
    return this.http.get<LabSummaryRow[]>(`${this.base}/lab-summary`, { params });
  }

  /** Distinct locations and SBs for the Lab Cost filter dropdowns. */
  getLabCostFilterOptions(): Observable<LabCostFilterOptions> {
    return this.http.get<LabCostFilterOptions>(`${this.base}/lab-cost/filter-options`);
  }

  /** Distinct FY Quarter, Location, SB values for the Lab Summary filter dropdowns (all horizons). */
  getLabSummaryFilterOptions(): Observable<LabSummaryFilterOptions> {
    return this.http.get<LabSummaryFilterOptions>(`${this.base}/lab-summary/filter-options`);
  }

  /** Service bundles with approval status for the SB Approval tab. */
  getSbApprovalOverview(horizon: string, ownerId = '', sbId = '', status = ''): Observable<SbApprovalRow[]> {
    let params = new HttpParams().set('horizon', horizon ?? '');
    if (ownerId) params = params.set('ownerId', ownerId);
    if (sbId) params = params.set('sbId', sbId);
    if (status) params = params.set('status', status);
    return this.http.get<SbApprovalRow[]>(`${this.base}/sb-approval/overview`, { params });
  }
}
