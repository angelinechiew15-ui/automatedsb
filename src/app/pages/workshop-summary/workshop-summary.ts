import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminService, WorkshopSummaryRow } from '../../services/admin.service';

@Component({
  selector: 'app-workshop-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h2>Workshop Summary</h2>

      @if (loading()) {
        <p class="status">Loading workshop data...</p>
      } @else if (error()) {
        <p class="status status-error">{{ error() }}</p>
      } @else if (rows().length === 0) {
        <p class="status">No workshop records found.</p>
      } @else {
        <div class="table-wrap" role="region" aria-label="Workshop summary table" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">FY</th>
                <th scope="col">Location</th>
                <th scope="col">Service Bundle</th>
                <th scope="col">RTU/TS</th>
              </tr>
            </thead>
            <tbody>
              @for (row of displayRows(); track row.fy + '|' + row.loc + '|' + row.sb + '|' + $index) {
                <tr>
                  <td>{{ row.fy }}</td>
                  <td>{{ row.loc }}</td>
                  <td>{{ row.sb }}</td>
                  <td class="num">{{ row.rtuts }}</td>
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
      padding: 1.5rem;
    }

    .status {
      margin-top: 0.75rem;
    }

    .status-error {
      color: #b00020;
    }

    .table-wrap {
      margin-top: 1rem;
      overflow: auto;
      max-height: 70vh;
      border: 1px solid #d9dde3;
      border-radius: 8px;
      background: #fff;
    }

    table {
      width: 100%;
      min-width: 640px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #edf0f4;
      text-align: left;
      font-size: 0.95rem;
      white-space: nowrap;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f6f8fb;
      font-weight: 600;
    }

    .num {
      text-align: right;
    }
  `]
})
export class WorkshopSummary {
  private readonly adminService = inject(AdminService);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly rows = signal<WorkshopSummaryRow[]>([]);
  protected readonly displayRows = computed(() => this.rows());

  constructor() {
    this.adminService.listWorkshopSummary().subscribe({
      next: (data) => {
        this.rows.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workshop summary data.');
        this.loading.set(false);
      },
    });
  }
}
