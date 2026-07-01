import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CostKeyOverviewRow {
  fy: string;
  loc: string;
  serviceBundle: string;
  clientCorridor: string;
  wbsElement: string;
  ccPercent: number;
  costKeur: number;
  key: number | null;
  totalCostDemand: number;
}

@Injectable({ providedIn: 'root' })
export class CostKeyService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  getOverview(horizon = '', fy = '', loc = '', sb = ''): Observable<CostKeyOverviewRow[]> {
    let params = new HttpParams();
    if (horizon) {
      params = params.set('horizon', horizon);
    }
    if (fy) {
      params = params.set('fy', fy);
    }
    if (loc) {
      params = params.set('loc', loc);
    }
    if (sb) {
      params = params.set('sb', sb);
    }

    return this.http.get<CostKeyOverviewRow[]>(`${this.base}/cost-key/overview`, { params });
  }
}
