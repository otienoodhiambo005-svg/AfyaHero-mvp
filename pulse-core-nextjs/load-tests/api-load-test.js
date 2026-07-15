import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'],      // Error rate must be less than 5%
    errors: ['rate<0.05'],                // Custom error rate must be less than 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'demo@medical.afyahero.com',
    password: 'Demo@1234'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!check(loginRes, { 'login successful': (r) => r.status === 200 })) {
    throw new Error('Login failed');
  }

  const token = loginRes.json('token');
  return { token };
}

export default function apiLoadTest(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test Phase 3 API endpoints
  const endpoints = [
    '/api/admin/public-health/outbreak-detection',
    '/api/admin/beds/predictive-management',
    '/api/admin/executive/intelligence',
    '/api/admin/quality/intelligence',
    '/api/medical/referrals/match',
    '/api/analytics/patient-flow-prediction',
    '/api/pharmacy/inventory/predict-demand',
    '/api/billing/insurance/optimize-claim',
  ];

  // Randomly select an endpoint to test
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers });
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has data': (r) => r.json() !== null,
  });
  
  errorRate.add(!success);

  // Small pause between requests
  sleep(Math.random() * 3 + 1); // 1-4 seconds random pause
}

export function teardown(data) {
  // Cleanup if needed
}
