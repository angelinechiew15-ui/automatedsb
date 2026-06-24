import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, WorkshopSbStatusRow } from '../../services/admin.service';
import { LookupItem, ServiceBundleService } from '../../services/service-bundle.service';

@Component({
  selector: 'app-workshop-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <h2>Workshop Summary</h2>

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
        <div class="field" style="flex-direction: row; align-items: flex-end;">
          <button class="btn-refresh" (click)="loadData()" [disabled]="!selectedHorizon() || loading()">
            &#8635; Refresh
          </button>
        </div>
      </div>

      @if (loading()) {
        <p class="status">Loading workshop summary data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select a horizon and click Refresh to view data.</p>
      } @else if (rows().length === 0) {
        <p class="status">No records found for the selected horizon.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Workshop summary table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th class="col-div">Div</th>
                <th class="col-subdiv">Sub Div</th>
                <th class="col-sb">SB</th>
                <th class="col-status">SB Status</th>
                <th class="col-summary">Summary</th>
                <th class="col-text">Comment</th>
                <th class="col-num">TSpM Demand</th>
                <th class="col-num">RTU Demand</th>
                <th class="col-num">Cost Demand</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.divName + '|' + row.sb) {
                <tr>
                  <td class="col-div">{{ row.divName }}</td>
                  <td class="col-subdiv">{{ row.subDiv }}</td>
                  <td class="col-sb">{{ row.sb }}</td>
                  <td class="col-status">
                    @if (row.sbStatus) {
                      <span class="badge" [class]="badgeClass(row.sbStatus)">{{ row.sbStatus }}</span>
                    }
                  </td>
                  <td class="col-summary">{{ row.summary }}</td>
                  <td class="col-text">{{ row.comment }}</td>
                  <td class="col-num">{{ row.tsDemand != null ? (row.tsDemand | number:'1.0-2') : '\u2014' }}</td>
                  <td class="col-num">{{ row.rtuDemand != null ? (row.rtuDemand | number:'1.0-2') : '\u2014' }}</td>
                  <td class="col-num">{{ row.costDemand != null ? (row.costDemand | number:'1.0-2') : '\u2014' }}</td>
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
    .page h2 { margin: 0 0 0.5rem; font-size: 1.4rem; }

    .toolbar {
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;
      margin-bottom: 1.25rem; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 180px; }
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

    .status { margin-top: 0.75rem; color: #6b7280; }
    .status-error { color: #b00020; }

    .table-wrap {
      margin-top: 1rem; overflow: auto; max-height: 70vh;
      border: 1px solid #d9dde3; border-radius: 8px; background: #fff;
    }

    table { border-collapse: collapse; width: 100%; }

    th, td {
      padding: 0.45rem 0.65rem;
      border: 1px solid #e5e7eb;
      text-align: left; font-size: 0.82rem;
    }

    thead th {
      background: #ab377a; color: #fff; font-weight: 600;
      position: sticky; top: 0; z-index: 1; white-space: nowrap;
    }

    tbody tr:hover { background: #f9fafb; }

    .col-div    { min-width: 110px; max-width: 140px; }
    .col-subdiv { min-width: 90px;  max-width: 120px; }
    .col-sb     { min-width: 160px; max-width: 220px; white-space: nowrap; }
    .col-status { min-width: 90px;  text-align: center; }
    .col-summary{ min-width: 150px; max-width: 220px; }
    .col-text   { min-width: 150px; max-width: 250px; }
    .col-num    { min-width: 110px; text-align: right; white-space: nowrap; }

    .badge {
      display: inline-block; padding: 0.2rem 0.5rem;
      border-radius: 4px; font-size: 0.78rem; font-weight: 600;
      white-space: nowrap;
    }
    .badge-approved  { background: #d1fae5; color: #065f46; }
    .badge-rejected  { background: #fee2e2; color: #991b1b; }
    .badge-pending   { background: #fef3c7; color: #92400e; }
    .badge-default   { background: #e5e7eb; color: #374151; }
  `],
})
export class WorkshopSummary implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly sbSvc    = inject(ServiceBundleService);

  protected readonly horizons        = signal<LookupItem[]>([]);
  protected readonly selectedHorizon = signal('');
  protected readonly rows            = signal<WorkshopSbStatusRow[]>([]);
  protected readonly loading         = signal(false);
  protected readonly error           = signal<string | null>(null);

  ngOnInit(): void {
    this.sbSvc.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) this.selectedHorizon.set(data[0].value);
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.rows.set([]);
  }

  protected loadData(): void {
    const h = this.selectedHorizon();
    if (!h) return;
    this.loading.set(true);
    this.error.set(null);
    this.adminSvc.getWorkshopSbStatus(h).subscribe({
      next:  (data) => { this.rows.set(data ?? []); this.loading.set(false); },
      error: ()     => { this.error.set('Failed to load workshop summary data.'); this.loading.set(false); },
    });
  }

  protected badgeClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('approv')) return 'badge badge-approved';
    if (s.includes('reject')) return 'badge badge-rejected';
    if (s.includes('pending') || s.includes('review')) return 'badge badge-pending';
    return 'badge badge-default';
  }
}

