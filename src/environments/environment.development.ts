// Development overrides — used by `ng serve` / `npm start`.
export const environment = {
  production: false,
  // Requests go through the ng serve proxy (proxy.conf.json -> automatedsbapi-git:8080).
  apiBase: '/api',
};
