/**
 * AfyaHero API Load Test
 * 
 * Load test for critical API endpoints using k6
 * Tests authentication, patient management, appointments, and clinical operations
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 50 },    // Ramp down to 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
    errors: ['rate<0.01'],             // Custom error rate must be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';
const API_BASE = `${BASE_URL}/api`;

// Test data
const testUser = {
  email: 'loadtest@example.com',
  password: 'TestPassword123!',
};

let authToken = '';

export function setup() {
  // Setup: Authenticate and get token
  const loginRes = http.post(`${API_BASE}/auth/login`, JSON.stringify(testUser), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    authToken = loginRes.json('token');
  }

  return { authToken };
}

export default function apiLoadTest(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.authToken}`,
  };

  // Test 1: Patient List API
  const patientsRes = http.get(`${API_BASE}/patients`, { headers });
  check(patientsRes, {
    'patients status 200': (r) => r.status === 200,
    'patients response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Appointments API
  const appointmentsRes = http.get(`${API_BASE}/appointments`, { headers });
  check(appointmentsRes, {
    'appointments status 200': (r) => r.status === 200,
    'appointments response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Lab Requests API
  const labRequestsRes = http.get(`${API_BASE}/lab-requests`, { headers });
  check(labRequestsRes, {
    'lab requests status 200': (r) => r.status === 200,
    'lab requests response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // Test 4: Prescriptions API
  const prescriptionsRes = http.get(`${API_BASE}/prescriptions`, { headers });
  check(prescriptionsRes, {
    'prescriptions status 200': (r) => r.status === 200,
    'prescriptions response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // Test 5: Clinical Vitals API
  const vitalsRes = http.get(`${API_BASE}/clinical-vitals`, { headers });
  check(vitalsRes, {
    'vitals status 200': (r) => r.status === 200,
    'vitals response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // Test 6: Create Patient (write operation)
  const newPatient = {
    name: `Load Test Patient ${Date.now()}`,
    phone: '+25470000000',
    gender: 'M',
    dob: '1990-01-01',
    status: 'Stable',
  };

  const createPatientRes = http.post(
    `${API_BASE}/patients`,
    JSON.stringify(newPatient),
    { headers }
  );
  check(createPatientRes, {
    'create patient status 201': (r) => r.status === 201 || r.status === 200,
    'create patient response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(2);

  // Test 7: Bot Analytics API
  const analyticsRes = http.get(`${API_BASE}/admin/bot/analytics`, { headers });
  check(analyticsRes, {
    'analytics status 200': (r) => r.status === 200,
    'analytics response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}

export function teardown(data) {
  // Cleanup: Delete test patients created during load test
  // This would require additional API calls to clean up test data
}
