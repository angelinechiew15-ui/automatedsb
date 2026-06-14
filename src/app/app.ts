import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
  IfxNavbar,
  IfxNavbarItem,
} from '@infineon/infineon-design-system-angular/standalone';

interface Tab {
  path: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, IfxNavbar, IfxNavbarItem],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('automatedsb');
  private readonly router = inject(Router);

  protected readonly tabs: Tab[] = [
    { path: '/service-bundle', label: 'Service Bundle' },
    { path: '/admin', label: 'Admin' },
    { path: '/sb-approval', label: 'SB Approval' },
    { path: '/lab-cost', label: 'Lab Cost' },
    { path: '/lab-summary', label: 'Lab Summary' },
    { path: '/workshop-summary', label: 'Workshop Summary' },
  ];

  protected go(path: string): void {
    this.router.navigateByUrl(path);
  }
}
