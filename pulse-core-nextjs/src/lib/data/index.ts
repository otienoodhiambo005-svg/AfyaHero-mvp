export { getPatients, getPatientById } from './patients';
export type { PatientRow, VitalsRow } from './patients';

export { getLabQueue } from './labs';
export type { LabQueueRow } from './labs';

export { getRxQueue, getTopDrugs } from './pharmacy';
export type { RxQueueRow, TopDrugRow } from './pharmacy';

export { getArrivals, getReceptionKPI } from './reception';
export type { ArrivalRow, ReceptionKPI } from './reception';

export { getWards, getAlerts, getStaffCounts } from './admin';
export type { WardRow, AlertRow } from './admin';

export {
  listHandovers,
  getHandoverById,
  createHandover,
  updateHandoverStatus,
  isDatabaseAvailable,
} from './handover';
export type { CreateHandoverInput } from './handover';

export {
  listTeleconsultAppointments,
  createTeleconsultAppointment,
  updateTeleconsultAppointmentStatus,
  listTeleconsultWaitroom,
  createTeleconsultWaitroomEntry,
  deleteTeleconsultWaitroomEntry,
} from './teleconsult';
export type {
  TeleconsultAppointmentRecord,
  TeleconsultWaitroomRecord,
  CreateTeleconsultAppointmentInput,
  CreateTeleconsultWaitroomInput,
  AppointmentStatus,
} from './teleconsult';
