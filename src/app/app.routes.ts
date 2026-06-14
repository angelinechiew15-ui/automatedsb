import { Routes } from '@angular/router';
import { ServiceBundle } from './pages/service-bundle/service-bundle';
import { Admin } from './pages/admin/admin';
import { SbApproval } from './pages/sb-approval/sb-approval';
import { LabCost } from './pages/lab-cost/lab-cost';
import { LabSummary } from './pages/lab-summary/lab-summary';
import { WorkshopSummary } from './pages/workshop-summary/workshop-summary';

export const routes: Routes = [
  { path: '', redirectTo: 'service-bundle', pathMatch: 'full' },
  { path: 'service-bundle', component: ServiceBundle },
  { path: 'admin', component: Admin },
  { path: 'sb-approval', component: SbApproval },
  { path: 'lab-cost', component: LabCost },
  { path: 'lab-summary', component: LabSummary },
  { path: 'workshop-summary', component: WorkshopSummary },
  { path: '**', redirectTo: 'service-bundle' }
];
