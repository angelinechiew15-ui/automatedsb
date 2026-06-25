import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { AdminService, WorkshopSbStatusRow, WsOption } from '../../services/admin.service';
import { LookupItem, ServiceBundleService } from '../../services/service-bundle.service';

interface GroupedSbRow {
  divName:   string;
  subDiv:    string;
  sb:        string;
  sbStatus:  string;
  comment:   string;
  summary:   string;
  fyDemands: Record<string, { tsDemand: number | null; rtuDemand: number | null; costDemand: number | null }>;
}

interface DisplayRow extends GroupedSbRow {
  divRowspan:    number;
  subDivRowspan: number;
}

@Component({
  selector: 'app-workshop-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="toolbar">
        <div class="field">
          <label>Horizon</label>
          <select [ngModel]="selectedHorizon()" (ngModelChange)="onHorizonChange($event)">
            <option value="">-- Select Horizon --</option>
            @for (h of horizons(); track h.value) {
              <option [value]="h.value">{{ h.text }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Division</label>
          <select [ngModel]="selectedDiv()" (ngModelChange)="onDivFilterChange($event)">
            <option value="">All</option>
            @for (d of divOptions(); track d) {
              <option [value]="d">{{ d }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label>Service Bundle</label>
          <select [ngModel]="selectedSbFilter()" (ngModelChange)="selectedSbFilter.set($event)">
            <option value="">All</option>
            @for (s of sbFilterOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </div>
        <div class="field" style="flex-direction:row; align-items:flex-end; gap:0.4rem;">
          <button class="btn-refresh" (click)="loadData()" [disabled]="!selectedHorizon() || loading()">
            &#8635; Refresh
          </button>
          <button class="btn-export" (click)="exportToExcel()" [disabled]="displayRows().length === 0">
            &#128190; Export Excel
          </button>
          <button class="btn-action" (click)="openCommentPanel()">+ Add Comments</button>
          <button class="btn-action" (click)="openSummaryPanel()">+ Add Summary</button>
        </div>
      </div>

      @if (showCommentPanel()) {
        <div class="panel">
          <div class="panel-header">
            <span>Add / Update SB Comment</span>
            <button class="btn-close" (click)="showCommentPanel.set(false)">&#10005;</button>
          </div>
          <div class="panel-body">
            <div class="panel-field">
              <label>Service Bundle</label>
              <select [ngModel]="selectedCommentSbId()" (ngModelChange)="onCommentSbChange($event)">
                <option value="">-- Select SB --</option>
                @for (sb of commentSbs(); track sb.id) {
                  <option [value]="sb.id">{{ sb.name }}</option>
                }
              </select>
            </div>
            <div class="panel-field panel-field-wide">
              <label>Comments, Demand and Cost Drivers</label>
              <textarea rows="4" [ngModel]="commentText()" (ngModelChange)="commentText.set($event)"
                        placeholder="Enter comment..."></textarea>
            </div>
            <div class="panel-actions">
              <button class="btn-save" (click)="saveComment()"
                      [disabled]="!selectedCommentSbId() || savingComment()">
                {{ commentExists() ? 'Update Comment' : 'Save Comment' }}
              </button>
              @if (commentSaveOk()) { <span class="save-ok">&#10003; Saved</span> }
              @if (commentSaveErr()) { <span class="save-err">{{ commentSaveErr() }}</span> }
            </div>
          </div>
        </div>
      }

      @if (showSummaryPanel()) {
        <div class="panel">
          <div class="panel-header">
            <span>Add / Update Division Summary</span>
            <button class="btn-close" (click)="showSummaryPanel.set(false)">&#10005;</button>
          </div>
          <div class="panel-body">
            <div class="panel-field">
              <label>Division</label>
              <select [ngModel]="selectedSummaryDivId()" (ngModelChange)="onSummaryDivChange($event)">
                <option value="">-- Select Division --</option>
                @for (d of summaryDivs(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>
            </div>
            <div class="panel-field panel-field-wide">
              <label>Comments, Demand and Cost Drivers</label>
              <textarea rows="4" [ngModel]="summaryText()" (ngModelChange)="summaryText.set($event)"
                        placeholder="Enter summary..."></textarea>
            </div>
            <div class="panel-actions">
              <button class="btn-save" (click)="saveSummary()"
                      [disabled]="!selectedSummaryDivId() || savingSummary()">
                {{ summaryExists() ? 'Update Summary' : 'Save Summary' }}
              </button>
              @if (summarySaveOk()) { <span class="save-ok">&#10003; Saved</span> }
              @if (summarySaveErr()) { <span class="save-err">{{ summarySaveErr() }}</span> }
            </div>
          </div>
        </div>
      }

      @if (loading()) {
        <p class="status">Loading workshop summary data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select a horizon and click Refresh to view data.</p>
      } @else if (displayRows().length === 0) {
        <p class="status">No records found for the selected filters.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Workshop summary table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th rowspan="2" class="col-div">Div</th>
                <th rowspan="2" class="col-subdiv">Sub Div</th>
                <th rowspan="2" class="col-sb">SB</th>
                <th rowspan="2" class="col-summary">Summary</th>
                <th rowspan="2" class="col-status">SB Status</th>
                <th rowspan="2" class="col-text">Comments, Demand and Cost Drivers</th>
                <th [attr.colspan]="activeFys().length" class="col-grp">TSpM Demand</th>
                <th [attr.colspan]="activeFys().length" class="col-grp">RTU Demand</th>
                <th [attr.colspan]="activeFys().length" class="col-grp">Cost Demand (k EUR)</th>
              </tr>
              <tr>
                @for (fy of activeFys(); track fy) { <th class="col-num col-fy">{{ fy }}</th> }
                @for (fy of activeFys(); track fy) { <th class="col-num col-fy">{{ fy }}</th> }
                @for (fy of activeFys(); track fy) { <th class="col-num col-fy">{{ fy }}</th> }
              </tr>
            </thead>
            <tbody>
              @for (row of displayRows(); track row.divName + '|' + row.subDiv + '|' + row.sb) {
                <tr>
                  @if (row.divRowspan > 0) {
                    <td [attr.rowspan]="row.divRowspan" class="col-div td-merged">{{ row.divName }}</td>
                  }
                  @if (row.subDivRowspan > 0) {
                    <td [attr.rowspan]="row.subDivRowspan" class="col-subdiv td-merged">{{ row.subDiv }}</td>
                  }
                  <td class="col-sb">{{ row.sb }}</td>
                  <td class="col-summary">{{ row.summary }}</td>
                  <td class="col-status">
                    @if (row.sbStatus) {
                      <span class="badge" [class]="badgeClass(row.sbStatus)">{{ row.sbStatus }}</span>
                    }
                  </td>
                  <td class="col-text">{{ row.comment }}</td>
                  @for (fy of activeFys(); track fy) {
                    <td class="col-num">{{ fyDemand(row, fy, 'ts') != null ? (fyDemand(row, fy, 'ts') | number:'1.0-2') : '\u2014' }}</td>
                  }
                  @for (fy of activeFys(); track fy) {
                    <td class="col-num">{{ fyDemand(row, fy, 'rtu') != null ? (fyDemand(row, fy, 'rtu') | number:'1.0-2') : '\u2014' }}</td>
                  }
                  @for (fy of activeFys(); track fy) {
                    <td class="col-num">{{ fyDemand(row, fy, 'cost') != null ? (fyDemand(row, fy, 'cost') | number:'1.0-2') : '\u2014' }}</td>
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
      font-size: 0.92rem; color: #1f2937;
    }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;
      margin-bottom: 1rem; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 160px; }
    .field label { font-weight: 500; font-size: 0.82rem; color: #374151; }
    .field select {
      padding: 0.45rem 0.6rem; border: 1px solid #d1d5db; border-radius: 5px;
      font-size: 0.9rem; font-family: inherit; background: #fff;
    }
    .btn-refresh {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid #ab377a; cursor: pointer;
      background: #fff; color: #ab377a; white-space: nowrap;
    }
    .btn-refresh:hover:not(:disabled) { background: #f9eef5; }
    .btn-refresh:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-export {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: none; cursor: pointer;
      background: #ab377a; color: #fff; white-space: nowrap;
    }
    .btn-export:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-action {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid #4b6eb4; cursor: pointer;
      background: #fff; color: #4b6eb4; white-space: nowrap;
    }
    .btn-action:hover { background: #eef1fa; }

    .panel {
      margin-bottom: 1rem; background: #fff;
      border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;
    }
    .panel-header {
      display: flex; justify-content: space-between; align-items: center;
      background: #f3f4f6; padding: 0.6rem 1rem;
      font-weight: 600; font-size: 0.88rem;
    }
    .btn-close { background: none; border: none; cursor: pointer; font-size: 1rem; color: #6b7280; }
    .btn-close:hover { color: #111; }
    .panel-body { padding: 1rem 1.25rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; }
    .panel-field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 200px; }
    .panel-field-wide { min-width: 380px; }
    .panel-field label { font-weight: 500; font-size: 0.82rem; color: #374151; }
    .panel-field select, .panel-field textarea {
      padding: 0.45rem 0.6rem; border: 1px solid #d1d5db; border-radius: 5px;
      font-size: 0.9rem; font-family: inherit; background: #fff;
    }
    .panel-field textarea { resize: vertical; }
    .panel-actions { display: flex; align-items: center; gap: 0.75rem; }
    .btn-save {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 1rem;
      border-radius: 5px; border: none; cursor: pointer;
      background: #ab377a; color: #fff;
    }
    .btn-save:disabled { opacity: 0.55; cursor: not-allowed; }
    .save-ok  { color: #065f46; font-weight: 600; font-size: 0.85rem; }
    .save-err { color: #b00020; font-size: 0.85rem; }

    .status { margin-top: 0.75rem; color: #6b7280; }
    .status-error { color: #b00020; }
    .table-wrap {
      margin-top: 0.75rem; overflow: auto; max-height: 70vh;
      border: 1px solid #d9dde3; border-radius: 8px; background: #fff;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.45rem 0.65rem; border: 1px solid #e5e7eb; text-align: left; font-size: 0.82rem; }
    thead th {
      background: #ab377a; color: #fff; font-weight: 600;
      position: sticky; top: 0; z-index: 1; white-space: nowrap;
    }
    .col-grp { text-align: center; background: #7b2257; }
    .col-fy  { background: #ab377a; }
    tbody tr:hover { background: #f9fafb; }
    .col-div    { min-width: 100px; max-width: 150px; }
    .col-subdiv { min-width: 80px;  max-width: 130px; }
    .col-sb     { min-width: 160px; max-width: 220px; white-space: nowrap; }
    .col-status { min-width: 90px;  text-align: center; }
    .col-summary{ min-width: 140px; max-width: 220px; white-space: normal; }
    .col-text   { min-width: 160px; max-width: 280px; white-space: normal; }
    .col-num    { min-width: 100px; text-align: right; white-space: nowrap; }
    .td-merged  { vertical-align: middle; font-weight: 500; background: #fafafa; }
    .badge {
      display: inline-block; padding: 0.2rem 0.5rem;
      border-radius: 4px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;
    }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-pending  { background: #fef3c7; color: #92400e; }
    .badge-default  { background: #e5e7eb; color: #374151; }
  `],
})
export class WorkshopSummary implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly sbSvc    = inject(ServiceBundleService);

  // ── Core data ─────────────────────────────────────────────────────────────
  protected readonly horizons        = signal<LookupItem[]>([]);
  protected readonly selectedHorizon = signal('');
  protected readonly rows            = signal<WorkshopSbStatusRow[]>([]);
  protected readonly loading         = signal(false);
  protected readonly error           = signal<string | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  protected readonly selectedDiv      = signal('');
  protected readonly selectedSbFilter = signal('');
  private readonly preloadedPairs     = signal<{ div: string; sb: string }[]>([]);

  protected readonly divOptions = computed(() => {
    const fromRows = [...new Set(this.groupedRows().map(r => r.divName).filter(Boolean))].sort();
    if (fromRows.length) return fromRows;
    return [...new Set(this.preloadedPairs().map(p => p.div).filter(Boolean))].sort();
  });

  protected readonly sbFilterOptions = computed(() => {
    const div = this.selectedDiv();
    if (this.groupedRows().length) {
      const rows = div ? this.groupedRows().filter(r => r.divName === div) : this.groupedRows();
      return [...new Set(rows.map(r => r.sb).filter(Boolean))].sort();
    }
    const pairs = div ? this.preloadedPairs().filter(p => p.div === div) : this.preloadedPairs();
    return [...new Set(pairs.map(p => p.sb).filter(Boolean))].sort();
  });

  // ── FY ────────────────────────────────────────────────────────────────────
  private readonly fyList = computed(() =>
    [...new Set(this.rows().map(r => r.fy).filter(Boolean))].sort()
  );

  protected readonly activeFys = computed((): string[] => {
    const fys = this.fyList();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fy1Start = month >= 10 ? year : year - 1;
    const cands = (s: number): Set<string> => {
      const a = String(s % 100).padStart(2, '0');
      const b = String((s + 1) % 100).padStart(2, '0');
      return new Set([`${a}/${b}`, `FY${a}/${b}`, `FY${s + 1}`, `${s + 1}`, b, `FY${b}`]);
    };
    const m1 = fys.find(f => cands(fy1Start).has(f));
    const m2 = fys.find(f => cands(fy1Start + 1).has(f));
    const result = [m1, m2].filter(Boolean) as string[];
    return result.length > 0 ? result : fys.slice(0, 2);
  });

  // ── Grouped rows ──────────────────────────────────────────────────────────
  private readonly groupedRows = computed((): GroupedSbRow[] => {
    const map = new Map<string, GroupedSbRow>();
    for (const row of this.rows()) {
      const key = `${row.divName}|${row.subDiv}|${row.sb}`;
      if (!map.has(key)) {
        map.set(key, { divName: row.divName, subDiv: row.subDiv, sb: row.sb,
          sbStatus: row.sbStatus, comment: row.comment, summary: row.summary, fyDemands: {} });
      }
      if (row.fy) {
        map.get(key)!.fyDemands[row.fy] = {
          tsDemand: row.tsDemand, rtuDemand: row.rtuDemand, costDemand: row.costDemand };
      }
    }
    return [...map.values()].sort((a, b) => {
      const dc = a.divName.localeCompare(b.divName);
      if (dc !== 0) return dc;
      const sc = a.subDiv.localeCompare(b.subDiv);
      return sc !== 0 ? sc : a.sb.localeCompare(b.sb);
    });
  });

  private readonly filteredGroupedRows = computed((): GroupedSbRow[] => {
    const div = this.selectedDiv();
    const sb  = this.selectedSbFilter();
    return this.groupedRows().filter(r => (!div || r.divName === div) && (!sb || r.sb === sb));
  });

  protected readonly displayRows = computed((): DisplayRow[] => {
    const rows = this.filteredGroupedRows();
    const result: DisplayRow[] = [];
    let i = 0;
    while (i < rows.length) {
      const divName = rows[i].divName;
      let divCount = 0;
      for (let j = i; j < rows.length && rows[j].divName === divName; j++) divCount++;
      let k = i;
      while (k < i + divCount) {
        const subDiv = rows[k].subDiv;
        let subDivCount = 0;
        for (let j = k; j < i + divCount && rows[j].subDiv === subDiv; j++) subDivCount++;
        for (let n = 0; n < subDivCount; n++) {
          result.push({ ...rows[k + n],
            divRowspan:    (k === i && n === 0) ? divCount    : 0,
            subDivRowspan: n === 0              ? subDivCount : 0,
          });
        }
        k += subDivCount;
      }
      i += divCount;
    }
    return result;
  });

  // ── Add Comments panel ────────────────────────────────────────────────────
  protected readonly showCommentPanel    = signal(false);
  protected readonly commentSbs          = signal<WsOption[]>([]);
  protected readonly selectedCommentSbId = signal('');
  protected readonly commentText         = signal('');
  protected readonly commentExists       = signal(false);
  protected readonly savingComment       = signal(false);
  protected readonly commentSaveOk       = signal(false);
  protected readonly commentSaveErr      = signal('');

  protected openCommentPanel(): void {
    this.showSummaryPanel.set(false);
    this.selectedCommentSbId.set(''); this.commentText.set('');
    this.commentExists.set(false); this.commentSaveOk.set(false); this.commentSaveErr.set('');
    if (!this.commentSbs().length) {
      this.adminSvc.getWorkshopSbOptions().subscribe({ next: d => this.commentSbs.set(d) });
    }
    this.showCommentPanel.set(true);
  }

  protected onCommentSbChange(id: string): void {
    this.selectedCommentSbId.set(id);
    this.commentText.set(''); this.commentExists.set(false);
    this.commentSaveOk.set(false); this.commentSaveErr.set('');
    if (!id) return;
    this.adminSvc.getWorkshopComment(id, 'N').subscribe({
      next: r => { this.commentText.set(r.comment ?? ''); this.commentExists.set(!!r.comment); }
    });
  }

  protected saveComment(): void {
    const id = this.selectedCommentSbId();
    if (!id) return;
    this.savingComment.set(true); this.commentSaveOk.set(false); this.commentSaveErr.set('');
    this.adminSvc.saveWorkshopComment(id, 'N', this.commentText()).subscribe({
      next:  () => { this.savingComment.set(false); this.commentSaveOk.set(true); this.commentExists.set(true); if (this.rows().length) this.loadData(); },
      error: (e: any) => { this.savingComment.set(false); this.commentSaveErr.set(e?.error?.message ?? 'Save failed.'); },
    });
  }

  // ── Add Summary panel ─────────────────────────────────────────────────────
  protected readonly showSummaryPanel     = signal(false);
  protected readonly summaryDivs          = signal<WsOption[]>([]);
  protected readonly selectedSummaryDivId = signal('');
  protected readonly summaryText          = signal('');
  protected readonly summaryExists        = signal(false);
  protected readonly savingSummary        = signal(false);
  protected readonly summarySaveOk        = signal(false);
  protected readonly summarySaveErr       = signal('');

  protected openSummaryPanel(): void {
    this.showCommentPanel.set(false);
    this.selectedSummaryDivId.set(''); this.summaryText.set('');
    this.summaryExists.set(false); this.summarySaveOk.set(false); this.summarySaveErr.set('');
    if (!this.summaryDivs().length) {
      this.adminSvc.getWorkshopDivOptions().subscribe({ next: d => this.summaryDivs.set(d) });
    }
    this.showSummaryPanel.set(true);
  }

  protected onSummaryDivChange(id: string): void {
    this.selectedSummaryDivId.set(id);
    this.summaryText.set(''); this.summaryExists.set(false);
    this.summarySaveOk.set(false); this.summarySaveErr.set('');
    if (!id) return;
    this.adminSvc.getWorkshopComment(id, 'Y').subscribe({
      next: r => { this.summaryText.set(r.comment ?? ''); this.summaryExists.set(!!r.comment); }
    });
  }

  protected saveSummary(): void {
    const id = this.selectedSummaryDivId();
    if (!id) return;
    this.savingSummary.set(true); this.summarySaveOk.set(false); this.summarySaveErr.set('');
    this.adminSvc.saveWorkshopComment(id, 'Y', this.summaryText()).subscribe({
      next:  () => { this.savingSummary.set(false); this.summarySaveOk.set(true); this.summaryExists.set(true); if (this.rows().length) this.loadData(); },
      error: (e: any) => { this.savingSummary.set(false); this.summarySaveErr.set(e?.error?.message ?? 'Save failed.'); },
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.sbSvc.listHorizons().subscribe({
      next: (data) => { this.horizons.set(data); if (data.length) this.selectedHorizon.set(data[0].value); },
      error: () => this.error.set('Failed to load horizons.'),
    });
    this.adminSvc.getWorkshopFilterOptions().subscribe({
      next: (pairs) => this.preloadedPairs.set(pairs),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.selectedDiv.set(''); this.selectedSbFilter.set('');
    this.rows.set([]);
  }

  protected onDivFilterChange(value: string): void {
    this.selectedDiv.set(value);
    this.selectedSbFilter.set('');
  }

  protected loadData(): void {
    const h = this.selectedHorizon();
    if (!h) return;
    this.loading.set(true); this.error.set(null);
    this.adminSvc.getWorkshopSbStatus(h).subscribe({
      next:  (data) => { this.rows.set(data ?? []); this.loading.set(false); },
      error: ()     => { this.error.set('Failed to load workshop summary data.'); this.loading.set(false); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  protected fyDemand(row: GroupedSbRow, fy: string, type: 'ts' | 'rtu' | 'cost'): number | null {
    const d = row.fyDemands[fy];
    if (!d) return null;
    return type === 'ts' ? d.tsDemand : type === 'rtu' ? d.rtuDemand : d.costDemand;
  }

  protected badgeClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('approv')) return 'badge badge-approved';
    if (s.includes('reject')) return 'badge badge-rejected';
    if (s.includes('pending') || s.includes('review')) return 'badge badge-pending';
    return 'badge badge-default';
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  protected exportToExcel(): void {
    const fys = this.activeFys();
    const headers = [
      'Div', 'Sub Div', 'SB', 'Summary', 'SB Status', 'Comments, Demand and Cost Drivers',
      ...fys.map(f => `TSpM Demand (${f})`),
      ...fys.map(f => `RTU Demand (${f})`),
      ...fys.map(f => `Cost Demand k EUR (${f})`),
    ];
    const data = this.filteredGroupedRows().map(r => [
      r.divName, r.subDiv, r.sb, r.summary, r.sbStatus, r.comment,
      ...fys.map(f => r.fyDemands[f]?.tsDemand ?? null),
      ...fys.map(f => r.fyDemands[f]?.rtuDemand ?? null),
      ...fys.map(f => r.fyDemands[f]?.costDemand ?? null),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workshop Summary');
    XLSX.writeFile(wb, `workshop-summary-${this.selectedHorizon() || 'all'}.xlsx`);
  }
}

