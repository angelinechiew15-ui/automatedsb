import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DeliveranceStatus {
  green: number;
  lightGreen: number;
  red: number;
}

export interface OwnerDeliveranceStatus {
  sbOwner: string;
  green: number;
  lightGreen: number;
  red: number;
}

export interface SbDeliveranceData {
  horizon: string;
  summary: DeliveranceStatus;
  byOwner: OwnerDeliveranceStatus[];
}

@Injectable({ providedIn: 'root' })
export class SbDeliveranceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  getDeliveranceStatus(horizon: string): Observable<SbDeliveranceData> {
    let params = new HttpParams();
    if (horizon) {
      params = params.set('horizon', horizon);
    }
    return this.http.get<SbDeliveranceData>(`${this.base}/sb-deliverance/status`, { params });
  }

  getHorizons(): Observable<{ text: string; value: string }[]> {
    return this.http.get<{ text: string; value: string }[]>(`${this.base}/refs/horizons`);
  }
}
