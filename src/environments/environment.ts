// Default (production) environment. Override in environment.development.ts.
export const environment = {
  production: true,
  // Same-origin in prod — assume the .NET API is reverse-proxied at /api.
  apiBase: '/api',
};
