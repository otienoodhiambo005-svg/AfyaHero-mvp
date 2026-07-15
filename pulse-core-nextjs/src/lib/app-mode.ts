export type AfyaHeroAppMode = 'full' | 'superadmin';

const rawAppMode = process.env.AFYAHERO_APP_MODE?.trim().toLowerCase();

export const APP_MODE: AfyaHeroAppMode = rawAppMode === 'superadmin' ? 'superadmin' : 'full';

export const isStandaloneSuperAdminMode = (): boolean => APP_MODE === 'superadmin';
