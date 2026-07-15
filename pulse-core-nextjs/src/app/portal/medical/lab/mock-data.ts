export interface LabResult {
  id: string;
  patient: string;
  ward: string;
  test: string;
  category: 'Hematology' | 'Biochemistry' | 'Microbiology' | 'Imaging';
  value: string;
  unit: string;
  range: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
  time: string;
  trends: number[];
}

export const LAB_RESULTS: LabResult[] = [
  {
    id: 'lr1',
    patient: 'Hassan Ali',
    ward: 'ICU',
    test: 'Potassium (K+)',
    category: 'Biochemistry',
    value: '6.4',
    unit: 'mmol/L',
    range: '3.5 - 5.1',
    status: 'Critical',
    time: '32m ago',
    trends: [4.2, 4.5, 4.8, 5.5, 6.1, 6.4]
  },
  {
    id: 'lr2',
    patient: 'Fatuma Wanjiru',
    ward: 'Maternity',
    test: 'Hemoglobin (Hb)',
    category: 'Hematology',
    value: '7.8',
    unit: 'g/dL',
    range: '12.0 - 15.5',
    status: 'Abnormal',
    time: '1h ago',
    trends: [12.5, 11.0, 9.5, 8.2, 7.8]
  },
  {
    id: 'lr3',
    patient: 'Peter Kamau',
    ward: 'Medical',
    test: 'Creatinine',
    category: 'Biochemistry',
    value: '1.4',
    unit: 'mg/dL',
    range: '0.7 - 1.3',
    status: 'Abnormal',
    time: '45m ago',
    trends: [0.9, 1.1, 1.3, 1.4]
  },
  {
    id: 'lr4',
    patient: 'Joseph Odhiambo',
    ward: 'Paediatrics',
    test: 'WBC Count',
    category: 'Hematology',
    value: '18.5',
    unit: 'x10³/µL',
    range: '4.5 - 11.0',
    status: 'Abnormal',
    time: '2h ago',
    trends: [9.0, 12.5, 15.0, 18.5]
  }
];
