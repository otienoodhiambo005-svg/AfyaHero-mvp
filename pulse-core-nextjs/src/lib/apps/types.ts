export type AppPrincipalKind = 'staff' | 'developer_app' | 'patient_app' | 'chp_app';

interface BaseAppPrincipal {
  hospitalId: string;
}

export interface StaffPrincipal extends BaseAppPrincipal {
  kind: 'staff';
  staffId: string;
  role: string;
}

export interface DeveloperAppPrincipal extends BaseAppPrincipal {
  kind: 'developer_app';
  appId: string;
  scopes: string[];
}

export interface PatientAppPrincipal extends BaseAppPrincipal {
  kind: 'patient_app';
  appId: string;
  scopes: string[];
}

export interface ChpAppPrincipal extends BaseAppPrincipal {
  kind: 'chp_app';
  appId: string;
  scopes: string[];
}

export type AppPrincipal =
  | StaffPrincipal
  | DeveloperAppPrincipal
  | PatientAppPrincipal
  | ChpAppPrincipal;
