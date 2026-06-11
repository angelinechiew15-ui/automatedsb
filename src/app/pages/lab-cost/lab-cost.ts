import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-lab-cost',
  standalone: true,
  template: `
    <section class="page">
      <h2>Lab Cost</h2>
      <div class="viz-wrapper">
        <iframe
          id="tableauViz"
          [src]="vizUrl"
          loading="lazy"
          title="Lab Cost Quarterly Average"
        ></iframe>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 1.5rem 1.5rem 1.5rem 3rem; }
    .viz-wrapper { width: 100%; }
    #tableauViz {
      width: 1200px;
      height: 800px;
      border: 0;
      max-width: 100%;
    }
  `],
})
export class LabCost {
  readonly vizUrl: SafeResourceUrl;

  constructor(sanitizer: DomSanitizer) {
    const url =
      'https://tableau.infineon.com/t/DS/views/AutomatedServiceBundle/LabCostQtrAvg' +
      '?:embed=y&:tabs=no&:toolbar=no&:showAppBanner=false' +
      '&:display_count=n&:showVizHome=n&:origin=viz_share_link';
    this.vizUrl = sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
