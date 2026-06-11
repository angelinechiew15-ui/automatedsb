import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Sbol {
  mapid: string;
  ethloc: string;
  rptloc: string;
  tstrue: string;
  rtutrue: string;
}
export interface Sb {
  sbmappingid: string;
  sb: string;
  sbname: string;
  ccid: string;
  ccname: string;
}
export interface Sb2sbowner {
  sb: string;
  sbname: string;
  persid: string;
  persname: string;
}
export interface SbPath {
  sb: string;
  localPath: string;
  iSharePath: string;
}
export interface EmailTemplate {
  horizon: string;
  firstemail: string;
  reminderemail: string;
  releaseemail: string;
}
export interface Sbcostmap {
  costmappingid: string;
  costcenter: string;
  rptlabid?: string;
  rptlab: string;
  receiverwbs: string;
  sbaffected: string;
  percentage: number;
  ccaffected: string;
  ccpercentage: number | null;
}
export interface Sbengovh {
  engovhid: string;
  loc: string;
  cc: string;
  val: number;
  fy: string;
}
export interface Sballmap {
  fy: string;
  loc: string;
  sb: string;
  rtuts: string;
  rtuts_old: string;
  costrtu_old: string;
}
export interface WorkshopSummaryRow {
  fy: string;
  loc: string;
  sb: string;
  rtuts: string;
}
export interface LookupItem {
  value: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // Outsourcing Location
  listSbol(): Observable<Sbol[]> {
    return this.http.get<Sbol[]>(`${this.base}/sbol`);
  }
  addSbol(body: Partial<Sbol>) {
    return this.http.post<Sbol>(`${this.base}/sbol`, body);
  }
  updateSbol(id: string, body: Partial<Sbol>) {
    return this.http.put<Sbol>(`${this.base}/sbol/${id}`, body);
  }
  deleteSbol(ids: string[]) {
    return this.http.post(`${this.base}/sbol/delete`, { ids });
  }

  // SB -> CC
  listSb(): Observable<Sb[]> {
    return this.http.get<Sb[]>(`${this.base}/sb`);
  }
  addSb(body: Partial<Sb>) {
    return this.http.post<Sb>(`${this.base}/sb`, body);
  }
  deleteSb(ids: string[]) {
    return this.http.post(`${this.base}/sb/delete`, { ids });
  }

  // SB Owner -> SB
  listSbOwners(): Observable<Sb2sbowner[]> {
    return this.http.get<Sb2sbowner[]>(`${this.base}/sb-owners`);
  }
  addSbOwner(sbname: string, persid: string) {
    return this.http.post<{ message: string }>(
      `${this.base}/sb-owners/add?newServiceBundleName=${encodeURIComponent(sbname)}&newServiceBundleOwner=${encodeURIComponent(persid)}`,
      {}
    );
  }
  updateOwner(sbIds: string[], newPersonId: string, newPersonName?: string) {
    return this.http.put(`${this.base}/sb-owners/owner`, {
      sbIds,
      newPersonId,
      newPersonName,
    });
  }

  // Paths
  getAllSbPaths() {
    return this.http.get<{ sbId: string; localPath: string; iSharePath: string }[]>(
      `${this.base}/sb-paths`
    );
  }
  getSbPath(sb: string) {
    return this.http.get<SbPath>(`${this.base}/sb-paths/${sb}`);
  }
  saveSbPath(body: {
    selectednewsb: string;
    localPath: string;
    iSharePath: string;
  }) {
    return this.http.put<{ success: boolean }>(`${this.base}/sb-paths`, body);
  }

  // Email templates
  getAllEmailTemplates() {
    return this.http.get<EmailTemplate[]>(`${this.base}/email-templates/all`);
  }
  getEmailTemplate(horizon: string) {
    return this.http.get<EmailTemplate>(
      `${this.base}/email-templates?horizon=${encodeURIComponent(horizon)}`,
    );
  }
  saveEmailTemplate(body: EmailTemplate) {
    return this.http.put<{ success: boolean }>(
      `${this.base}/email-templates`,
      body,
    );
  }

  // Cost mappings
  listCostMappings(): Observable<Sbcostmap[]> {
    return this.http.get<Sbcostmap[]>(`${this.base}/cost-mappings`);
  }
  addCostMapping(body: Partial<Sbcostmap>) {
    return this.http.post<Sbcostmap>(`${this.base}/cost-mappings`, body);
  }
  updateCostMapping(id: string, body: Partial<Sbcostmap>) {
    return this.http.put<Sbcostmap>(`${this.base}/cost-mappings/${id}`, body);
  }
  deleteCostMapping(id: string) {
    return this.http.delete(`${this.base}/cost-mappings/${id}`);
  }
  exportCostMappings(locationFilter: string, sbNameFilter: string, sbCostMappings: Sbcostmap[]) {
    return this.http.post(`${this.base}/cost-mappings/export`, {
      locationFilter,
      sbNameFilter,
      sbCostMappings,
    }, {
      responseType: 'blob',
    });
  }

  // ENG OVH
  listEngovh(): Observable<Sbengovh[]> {
    return this.http.get<Sbengovh[]>(`${this.base}/engovh`);
  }
  listEngovhLocations(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.base}/engovh/locations`);
  }
  listEngovhClientCorridors(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.base}/engovh/client-corridors`);
  }
  addEngovh(body: Partial<Sbengovh>) {
    return this.http.post<Sbengovh>(`${this.base}/engovh`, body);
  }
  updateEngovh(id: string, body: Partial<Sbengovh>) {
    return this.http.put<Sbengovh>(`${this.base}/engovh/${id}`, body);
  }
  deleteEngovh(ids: string[]) {
    return this.http.post(`${this.base}/engovh/delete`, { ids });
  }

  // Sballmap (RTU/TS, Cost/RTU) - read-only
  listSballmap(): Observable<Sballmap[]> {
    return this.http.get<Sballmap[]>(`${this.base}/sballmap`);
  }

  // Workshop Summary (from v_sb_asb_data)
  listWorkshopSummary(): Observable<WorkshopSummaryRow[]> {
    return this.http.get<WorkshopSummaryRow[]>(`${this.base}/workshop-summary`);
  }

  // ORM Summary
  getMaxHorizon() {
    return this.http.get<{ success: boolean; horizon: string }>(
      `${this.base}/orm-summary/max-horizon`,
    );
  }
  getOrmSummary(horizon: string) {
    return this.http.get<{ success: boolean; comment: string }>(
      `${this.base}/orm-summary/${horizon}`,
    );
  }
  getPreviousOrmSummary(horizon: string) {
    return this.http.get<{
      success: boolean;
      comment: string;
      previousHorizon: string | null;
    }>(`${this.base}/orm-summary/${horizon}/previous`);
  }
  saveOrmSummary(horizon: string, statement: string) {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.base}/orm-summary`,
      { horizon, statement },
    );
  }

  // Due date
  getDueDate(horizon: string) {
    return this.http.get<{ dueDate: string }>(
      `${this.base}/due-dates/${horizon}`,
    );
  }
  saveDueDate(horizon: string, dueDate: string) {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.base}/due-dates`,
      { horizon, dueDate },
    );
  }

  // Location lookups (dedicated endpoints)
  listExtLocation(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.base}/sbol/extlocation`);
  }
  listRptLocation(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.base}/sbol/rptlocation`);
  }

  // Reference lookups
  listRef(
    key:
      | 'newsb'
      | 'newcc'
      | 'sbOwners'
      | 'horizons'
      | 'sb-names',
  ) {
    if (key === 'newsb') {
      return this.http.get<LookupItem[]>(`${this.base}/sb/ref/newsb`);
    }
    if (key === 'newcc') {
      return this.http.get<LookupItem[]>(`${this.base}/sb/ref/newcc`);
    }
    return this.http.get<LookupItem[]>(`${this.base}/refs/${key}`);
  }
  addRef(
    key: 'ethloc' | 'rptloc' | 'newsb' | 'newcc' | 'sbOwners' | 'horizons',
    value: string,
    text: string,
  ) {
    return this.http.post<LookupItem>(`${this.base}/refs/${key}`, {
      value,
      text,
    });
  }
  deleteRef(
    key: 'ethloc' | 'rptloc' | 'newsb' | 'newcc' | 'sbOwners' | 'horizons',
    value: string,
  ) {
    return this.http.delete(`${this.base}/refs/${key}/${value}`, {
      params: new HttpParams(),
    });
  }
}
