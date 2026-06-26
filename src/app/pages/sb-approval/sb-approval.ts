import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
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
          <button class="btn-export" (click)="exportToExcel()" [disabled]="sortedFilteredRows().length === 0">
            &#128190; Export to Excel
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
                <th (click)="sortByColumn('horizon')" style="cursor: pointer;">Horizon{{ getSortIcon('horizon') }}</th>
                <th (click)="sortByColumn('sbName')" style="cursor: pointer;">SB Name{{ getSortIcon('sbName') }}</th>
                <th (click)="sortByColumn('publishDate')" style="cursor: pointer;">Publish Date{{ getSortIcon('publishDate') }}</th>
                <th (click)="sortByColumn('customerGroup')" style="cursor: pointer;">Customer Group{{ getSortIcon('customerGroup') }}</th>
                <th (click)="sortByColumn('customerName')" style="cursor: pointer;">Customer Name{{ getSortIcon('customerName') }}</th>
                <th (click)="sortByColumn('approvalStatus')" style="cursor: pointer;">Approval Status{{ getSortIcon('approvalStatus') }}</th>
                <th (click)="sortByColumn('reason')" style="cursor: pointer;">Reason{{ getSortIcon('reason') }}</th>
                <th (click)="sortByColumn('approvalDate')" style="cursor: pointer;">Approval Date{{ getSortIcon('approvalDate') }}</th>
                <th (click)="sortByColumn('sbStatus')" style="cursor: pointer;">SB Status{{ getSortIcon('sbStatus') }}</th>
                <th (click)="sortByColumn('releaseDate')" style="cursor: pointer;">Release Date{{ getSortIcon('releaseDate') }}</th>
                <th (click)="sortByColumn('conditionalRelease')" style="cursor: pointer;">Conditional Release{{ getSortIcon('conditionalRelease') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of sortedFilteredRows(); track r.horizon + '|' + r.sbName + '|' + r.customerName) {
                <tr>
                  <td>{{ selectedHorizonName() }}</td>
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
                  <td>
                    @if (canShowConditionalRelease(r)) {
                      <button class="btn-conditional" (click)="openConditionalReleaseModal(r)">Conditional Release</button>
                    }
                    @if (r.conditionalRelease) {
                      <div class="conditional-text">{{ r.conditionalRelease }}</div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (showConditionalModal()) {
        <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Conditional Release Form">
          <div class="modal-panel">
            <h3>Conditional Release</h3>

            <div class="modal-row">
              <label>Horizon</label>
              <input type="text" [value]="selectedHorizonName() || selectedHorizon()" readonly>
            </div>

            <div class="modal-row">
              <label>SB Name</label>
              <input type="text" [value]="selectedConditionalRow()?.sbName ?? ''" readonly>
            </div>

            <div class="modal-row">
              <label>Remark</label>
              <textarea
                rows="4"
                [ngModel]="conditionalRemark()"
                (ngModelChange)="conditionalRemark.set($event)"
                placeholder="Enter conditional release remark"></textarea>
            </div>

            @if (conditionalModalError()) {
              <p class="status status-error">{{ conditionalModalError() }}</p>
            }

            <div class="modal-actions">
              <button class="btn-search" (click)="closeConditionalReleaseModal()" [disabled]="submittingConditional()">Cancel</button>
              <button class="btn-export" (click)="submitConditionalRelease()" [disabled]="submittingConditional()">
                {{ submittingConditional() ? 'Submitting...' : 'Submit' }}
              </button>
            </div>
          </div>
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
    .btn-export {
      font-family: inherit; font-size: 0.85rem; padding: 0.45rem 0.85rem;
      border-radius: 5px; border: 1px solid transparent; cursor: pointer;
      background: #ab377a; color: #fff; white-space: nowrap;
    }
    .btn-export:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-conditional {
      font-family: inherit; font-size: 0.74rem; padding: 0.3rem 0.5rem;
      border-radius: 4px; border: 1px solid #ab377a; cursor: pointer;
      background: #fff; color: #ab377a;
    }
    .btn-conditional:hover { background: #f9eef5; }
    .conditional-text { margin-top: 0.35rem; color: #374151; white-space: normal; }
    .status { margin-top: 0.75rem; color: #6b7280; }
    .status-error { color: #b00020; }
    .table-wrap {
      margin-top: 0.75rem; overflow-x: auto; overflow-y: auto; max-height: 70vh;
      border: 1px solid #d9dde3; border-radius: 8px; background: #fff;
    }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { padding: 0.5rem 0.6rem; border: 1px solid #e5e7eb; text-align: left; font-size: 0.78rem; white-space: nowrap; width: calc(100% / 11); }
    thead th {
      background: #ab377a; color: #fff; font-weight: 600;
      position: sticky; top: 0; z-index: 2; width: calc(100% / 11);
      cursor: pointer; user-select: none; transition: background 0.2s ease;
    }
    thead th:hover { background: #8a2d63; }
    tbody tr:hover { background: #f9fafb; }
    .badge {
      display: inline-block; padding: 0.2rem 0.5rem;
      border-radius: 4px; font-size: 0.78rem; font-weight: 600; white-space: nowrap;
    }
    .badge-approved { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-pending  { background: #fef3c7; color: #92400e; }
    .badge-default  { background: #e5e7eb; color: #374151; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(17, 24, 39, 0.45);
      display: flex; align-items: center; justify-content: center; z-index: 50;
      padding: 1rem;
    }
    .modal-panel {
      width: min(540px, 100%); background: #fff; border-radius: 10px;
      border: 1px solid #e5e7eb; padding: 1rem 1.1rem;
      box-shadow: 0 16px 36px rgba(17, 24, 39, 0.24);
    }
    .modal-panel h3 {
      margin: 0 0 0.75rem; color: #111827; font-size: 1.06rem;
    }
    .modal-row {
      display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem;
    }
    .modal-row label { font-weight: 600; font-size: 0.82rem; color: #374151; }
    .modal-row input,
    .modal-row textarea {
      width: 100%; font: inherit; font-size: 0.88rem; color: #111827;
      border: 1px solid #d1d5db; border-radius: 6px; padding: 0.5rem 0.6rem;
      background: #fff;
    }
    .modal-row input[readonly] { background: #f9fafb; }
    .modal-actions {
      display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.8rem;
    }
  `]
})
export class SbApproval implements OnInit {
  private readonly api = inject(ServiceBundleService);

  protected readonly horizons = signal<LookupItem[]>([]);
  protected readonly owners = signal<LookupItem[]>([]);
  protected readonly sbOptions = signal<LookupItem[]>([]);
  protected readonly rows = signal<SbApprovalRow[]>([]);

  protected readonly selectedHorizon = signal('');        // Horizon ID (numeric)
  protected readonly selectedHorizonName = signal('');    // Horizon name for display
  protected readonly selectedOwnerId = signal('');
  protected readonly selectedSbId = signal('');
  protected readonly selectedStatus = signal('');

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showConditionalModal = signal(false);
  protected readonly selectedConditionalRow = signal<SbApprovalRow | null>(null);
  protected readonly conditionalRemark = signal('');
  protected readonly conditionalModalError = signal<string | null>(null);
  protected readonly submittingConditional = signal(false);

  protected readonly sortColumn = signal<string>('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected readonly statusOptions = computed(() => {
    const unique = [...new Set(this.rows().map(r => r.approvalStatus).filter(Boolean))].sort();
    return unique.length ? unique : ['APPROVED', 'REJECTED', 'PENDING', 'NO_STATUS'];
  });

  protected readonly sortedFilteredRows = computed(() => {
    const horizon = this.selectedHorizon();
    let filtered = this.rows().filter(r => !horizon || r.horizon === horizon);

    const col = this.sortColumn();
    if (!col) return filtered;

    const dir = this.sortDirection();
    return filtered.sort((a, b) => {
      const aVal = (a as any)[col] ?? '';
      const bVal = (b as any)[col] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  ngOnInit(): void {
    this.api.listHorizons().subscribe({
      next: (data) => {
        this.horizons.set(data);
        if (data.length) {
          this.selectedHorizon.set(data[0].value);    // Set horizon ID
          this.selectedHorizonName.set(data[0].text); // Set horizon name
        }
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
    // Find and set the horizon name for display
    const selected = this.horizons().find(h => h.value === value);
    this.selectedHorizonName.set(selected?.text ?? '');
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

  protected exportToExcel(): void {
    const exportRows = this.sortedFilteredRows().map((r) => ({
      Horizon: this.selectedHorizonName() || this.selectedHorizon(),
      'SB Name': r.sbName,
      'Publish Date': r.publishDate ?? '',
      'Customer Group': r.customerGroup,
      'Customer Name': r.customerName,
      'Approval Status': r.approvalStatus,
      Reason: r.reason,
      'Approval Date': r.approvalDate ?? '',
      'SB Status': r.sbStatus,
      'Release Date': r.releaseDate ?? '',
      'Conditional Release': r.conditionalRelease ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SB Approval');
    const suffix = (this.selectedHorizonName() || this.selectedHorizon() || 'all').replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `sb-approval-${suffix}.xlsx`);
  }

  protected canShowConditionalRelease(row: SbApprovalRow): boolean {
    return (row.sbStatus ?? '').trim().toLowerCase() === 'onhold';
  }

  protected openConditionalReleaseModal(row: SbApprovalRow): void {
    this.selectedConditionalRow.set(row);
    this.conditionalRemark.set(row.conditionalRelease ?? '');
    this.conditionalModalError.set(null);
    this.showConditionalModal.set(true);
  }

  protected closeConditionalReleaseModal(): void {
    this.showConditionalModal.set(false);
    this.selectedConditionalRow.set(null);
    this.conditionalRemark.set('');
    this.conditionalModalError.set(null);
    this.submittingConditional.set(false);
  }

  protected submitConditionalRelease(): void {
    const row = this.selectedConditionalRow();
    if (!row || !row.approvalId) {
      this.conditionalModalError.set('Missing approval row reference.');
      return;
    }

    this.submittingConditional.set(true);
    this.conditionalModalError.set(null);
    this.api.updateConditionalReleaseRemark({
      approvalId: row.approvalId,
      remark: this.conditionalRemark().trim(),
    }).subscribe({
      next: () => {
        const nextRows = this.rows().map((r) =>
          r.approvalId === row.approvalId
            ? { ...r, conditionalRelease: this.conditionalRemark().trim() }
            : r,
        );
        this.rows.set(nextRows);
        this.submittingConditional.set(false);
        this.closeConditionalReleaseModal();
      },
      error: () => {
        this.submittingConditional.set(false);
        this.conditionalModalError.set('Failed to update conditional release remark.');
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

  protected sortByColumn(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  protected getSortIcon(col: string): string {
    if (this.sortColumn() !== col) return ' ⇅';
    return this.sortDirection() === 'asc' ? ' ↑' : ' ↓';
  }
}
