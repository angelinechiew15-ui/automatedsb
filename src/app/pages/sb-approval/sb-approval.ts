import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookupItem, SbApprovalRow, ServiceBundleService } from '../../services/service-bundle.service';

@Component({
  selector: 'app-sb-approval',
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
          <label>Service Bundle Owner</label>
          <select [ngModel]="selectedOwnerId()" (ngModelChange)="onOwnerChange($event)">
            <option value="">All</option>
            @for (o of owners(); track o.value) {
              <option [value]="o.value">{{ o.text }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>Service Bundle</label>
          <select [ngModel]="selectedSbId()" (ngModelChange)="selectedSbId.set($event)">
            <option value="">All</option>
            @for (sb of sbOptions(); track sb.value) {
              <option [value]="sb.value">{{ sb.text }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>Approval Status</label>
          <select [ngModel]="selectedStatus()" (ngModelChange)="selectedStatus.set($event)">
            <option value="">All</option>
            @for (s of statusOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </div>

        <div class="field" style="justify-content: flex-end; flex-direction: row; gap: 0.5rem; align-items: flex-end;">
          <button class="btn-search" (click)="loadData()" [disabled]="!selectedHorizon() || loading()">
            &#128269; Search
          </button>
        </div>
      </div>

      @if (loading()) {
        <p class="status">Loading SB approval data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (!selectedHorizon()) {
        <p class="status">Select filters and click Search to view approval status.</p>
      } @else if (rows().length === 0) {
        <p class="status">No data found.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="SB approval table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Horizon</th>
                <th>SB Name</th>
                <th>Publish Date</th>
                <th>Customer Group</th>
                <th>Customer Name</th>
                <th>Approval Status</th>
                <th>Reason</th>
                <th>Approval Date</th>
                <th>SB Status</th>
                <th>Release Date</th>
                <th>Conditional Release</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.horizon + '|' + r.sbName) {
                <tr>
                  <td>{{ r.horizon }}</td>
                  <td>{{ r.sbName }}</td>
                  <td>{{ r.publishDate }}</td>
                  <td>{{ r.customerGroup }}</td>
                  <td>{{ r.customerName }}</td>
                  <td>
                    <span class="badge" [class]="statusClass(r.approvalStatus)">{{ r.approvalStatus }}</span>
                  </td>
                  <td>{{ r.reason }}</td>
                  <td>{{ r.approvalDate }}</td>
                  <td>{{ r.sbStatus }}</td>
                  <td>{{ r.releaseDate }}</td>
                  <td>{{ r.conditionalRelease }}</td>
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
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;
      margin-bottom: 1rem; background: #fff;
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 180px; }
    .field label { font-weight: 500; font-size: 0.82rem; color: #374151; }
    .field select {
      padding: 0.45rem 0.6rem; border: 1px solid #d1d5db; border-radius: 5px;
      font-size: 0.9rem; font-family: inherit; background: #fff;
    }
    .btn-search {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid #ab377a; cursor: pointer;
      background: #fff; color: #ab377a; white-space: nowrap;
    }
    .btn-search:hover:not(:disabled) { background: #f9eef5; }
    .btn-search:disabled { opacity: 0.55; cursor: not-allowed; }
    .status { margin-top: 0.75rem; color: #6b7280; }
    .status-error { color: #b00020; }
    .table-wrap {
      margin-top: 0.75rem; overflow-x: auto; overflow-y: auto; max-height: 70vh;
      border: 1px solid #d9dde3; border-radius: 8px; background: #fff;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.5rem 0.6rem; border: 1px solid #e5e7eb; text-align: left; font-size: 0.78rem; white-space: nowrap; min-width: 85px; }
    thead th {
      background: #ab377a; color: #fff; font-weight: 600;
      position: sticky; top: 0; z-index: 2; min-width: 85px;
    }
    tbody tr:hover { background: #f9fafb; }
    .badge {
      display: inline-block; padding: 0.2rem 0.5rem;
      border-radius: 4px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;
    }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-pending  { background: #fef3c7; color: #92400e; }
    .badge-default  { background: #e5e7eb; color: #374151; }
  `]
})
export class SbApproval implements OnInit {
  private readonly api = inject(ServiceBundleService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly owners = signal<LookupItem[]>([]);
  protected readonly sbOptions = signal<LookupItem[]>([]);
  protected readonly rows = signal<SbApprovalRow[]>([]);

  protected readonly selectedHorizon = signal('');
  protected readonly selectedOwnerId = signal('');
  protected readonly selectedSbId = signal('');
  protected readonly selectedStatus = signal('');

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly statusOptions = computed(() => {
    const unique = [...new Set(this.rows().map(r => r.approvalStatus).filter(Boolean))].sort();
    return unique.length ? unique : ['APPROVED', 'REJECTED', 'PENDING', 'NO_STATUS'];
  });

  ngOnInit(): void {
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) this.selectedHorizon.set(data[0].value);
      },
      error: () => this.error.set('Failed to load horizons.'),
    });
    this.api.listOwners().subscribe({
      next: (data) => this.owners.set(data),
      error: () => this.error.set('Failed to load service bundle owners.'),
    });
    this.loadSbOptions('');
  }

  protected onHorizonChange(value: string): void {
    this.selectedHorizon.set(value);
    this.rows.set([]);
  }

  protected onOwnerChange(ownerId: string): void {
    this.selectedOwnerId.set(ownerId);
    this.selectedSbId.set('');
    this.rows.set([]);
    this.loadSbOptions(ownerId);
  }

  private loadSbOptions(ownerId: string): void {
    this.api.listSbNames(ownerId).subscribe({
      next: (list) => this.sbOptions.set(list),
      error: () => this.error.set('Failed to load service bundle options.'),
    });
  }

  protected loadData(): void {
    const h = this.selectedHorizon();
    if (!h) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.getSbApprovalOverview(h, this.selectedOwnerId(), this.selectedSbId(), this.selectedStatus()).subscribe({
      next: (data) => {
        this.rows.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load SB approval data.');
      },
    });
  }

  protected statusClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.includes('approv')) return 'badge badge-approved';
    if (s.includes('reject')) return 'badge badge-rejected';
    if (s.includes('pending') || s.includes('no_status')) return 'badge badge-pending';
    return 'badge badge-default';
  }
}
