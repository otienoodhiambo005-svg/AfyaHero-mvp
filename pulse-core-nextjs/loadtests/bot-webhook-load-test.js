/**
 * AfyaHero Bot Webhook Load Test
 * 
 * Load test for WhatsApp and USSD bot webhook endpoints
 * Tests webhook handling under high load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const webhookSuccessRate = new Rate('webhook_success');

// Configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 requests/sec
    { duration: '3m', target: 50 },   // Ramp up to 50 requests/sec
    { duration: '5m', target: 100 },  // Stay at 100 requests/sec
    { duration: '3m', target: 50 },   // Ramp down to 50 requests/sec
    { duration: '1m', target: 0 },    // Ramp down to 0 requests/sec
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.05'],    // Error rate must be less than 5%
    errors: ['rate<0.05'],
    webhook_success_rate: ['rate>0.95'], // 95% webhook success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3003';

export default function botWebhookLoadTest() {
  const headers = {
    'Content-Type': 'application/json',
    'x-africas-talking-signature': 'test-signature',
  };

  // Test 1: WhatsApp Webhook
  const whatsappPayload = {
    event: 'message',
    data: [{
      id: `msg-${Date.now()}-${Math.random()}`,
      direction: 'inbound',
      from: `+254700000${Math.floor(Math.random() * 9999)}`,
      to: '+254711111111',
      text: 'HELP',
      timestamp: Date.now(),
    }],
  };

  const whatsappRes = http.post(
    `${BASE_URL}/api/bot/whatsapp/webhook`,
    JSON.stringify(whatsappPayload),
    { headers }
  );

  check(whatsappRes, {
    'whatsapp webhook status 200': (r) => r.status === 200,
    'whatsapp webhook response time < 200ms': (r) => r.timings.duration < 200,
    'whatsapp webhook success response': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  if (whatsappRes.status === 200 && whatsappRes.json('success') === true) {
    webhookSuccessRate.add(1);
  }

  sleep(0.1);

  // Test 2: USSD Webhook
  const ussdPayload = new URLSearchParams({
    sessionId: `session-${Date.now()}-${Math.random()}`,
    serviceCode: '*123#',
    phoneNumber: `+254700000${Math.floor(Math.random() * 9999)}`,
    text: '',
  });

  const ussdRes = http.post(
    `${BASE_URL}/api/bot/ussd/webhook`,
    ussdPayload.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  check(ussdRes, {
    'ussd webhook status 200': (r) => r.status === 200,
    'ussd webhook response time < 200ms': (r) => r.timings.duration < 200,
    'ussd webhook has response': (r) => r.body.length > 0,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 3: Bot Analytics API
  const analyticsRes = http.get(`${BASE_URL}/api/admin/bot/analytics`);

  check(analyticsRes, {
    'analytics status 200': (r) => r.status === 200,
    'analytics response time < 500ms': (r) => r.timings.duration < 500,
    'analytics has stats': (r) => r.json('stats') !== undefined,
  }) || errorRate.add(1);

  sleep(0.5);
}
