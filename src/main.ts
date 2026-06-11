import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements } from '@infineon/infineon-design-system-stencil/loader';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Register all <ifx-*> custom elements with the browser (no-op during SSR).
if (typeof window !== 'undefined') {
  defineCustomElements(window);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
