import { Component } from '@angular/core';

@Component({
  selector: 'app-service-bundle-owner',
  standalone: true,
  template: `
    <section class="page">
      <h2>Service Bundle Owner</h2>
      <p>Manage service bundle owners here.</p>
    </section>
  `,
  styles: [`.page { padding: 1.5rem; }`]
})
export class ServiceBundleOwner {}
