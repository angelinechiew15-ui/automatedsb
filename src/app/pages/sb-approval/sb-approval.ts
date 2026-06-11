import { Component } from '@angular/core';

@Component({
  selector: 'app-sb-approval',
  standalone: true,
  template: `
    <section class="page">
      <h2>SB Approval</h2>
      <p>Review and approve service bundle requests.</p>
    </section>
  `,
  styles: [`.page { padding: 1.5rem; }`]
})
export class SbApproval {}
