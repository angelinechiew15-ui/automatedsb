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
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ServiceBundleCharts {
  success: boolean;
  demand: ChartPoint[];
  rtu: ChartPoint[];
  testStarts: ChartPoint[];
  pareto: ChartPoint[];
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
  getDashboard(sbId: string): Observable<ServiceBundleDashboard> {
    const params = new HttpParams().set('sbId', sbId);
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
}
