/**
 * API paths wrapped with `withAuthzAndTenant` — tenant must never be passed as `?hospitalId=`.
 * Keep in sync with `src/lib/middleware/withAuthzAndTenant` usages.
 */
export const TENANT_PROTECTED_GET_PATHS = [
  '/api/admin/dashboard',
  '/api/admin/executive/intelligence',
  '/api/admin/quality/intelligence',
  '/api/admin/bed/predictive-management',
  '/api/pharmacy/formulary',
  '/api/pharmacy/inventory/predict-demand',
  '/api/analytics/patient-flow-prediction',
  '/api/medical/patients/00000000-0000-0000-0000-000000000001/discharge-prediction',
] as const;
